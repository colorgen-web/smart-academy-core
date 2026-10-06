-- 학원과 소속
-- 한 사람이 여러 학원에 (원장·강사·학부모·학생으로) 소속될 수 있다.
--   학원 등록: 원장(회원 유형 director)이 등록 → 운영자(admin)가 승인
--   학원 가입: 학원 코드로 신청 → 그 학원 원장이 승인
-- 모든 쓰기는 아래 함수(RPC)로만 한다. 테이블에 직접 쓰는 권한은 주지 않는다.

create table public.academies (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  phone text check (phone is null or phone ~ '^0[0-9]{8,10}$'),
  address text check (address is null or char_length(address) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- 가입 신청용 코드 (헷갈리는 글자 0/O, 1/I/L 제외 6자리)
  join_code text not null unique check (join_code ~ '^[A-HJ-KM-NP-Z2-9]{6}$'),
  owner_id uuid not null references auth.users (id) on delete restrict,
  review_note text check (review_note is null or char_length(review_note) <= 200),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index academies_status_idx on public.academies (status, created_at desc);

create table public.academy_members (
  academy_id bigint not null references public.academies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('director', 'teacher', 'parent', 'student')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  primary key (academy_id, user_id)
);

create index academy_members_user_idx on public.academy_members (user_id);

create trigger academies_touch_updated_at
before update on public.academies
for each row execute function public.touch_updated_at();

-- ── 권한 확인 함수 (RLS 안에서 academy_members 를 다시 읽으므로 security definer 로 재귀를 피한다) ──

create function public.is_academy_director(p_academy_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_members m
    join public.academies a on a.id = m.academy_id
    where m.academy_id = p_academy_id
      and m.user_id = auth.uid()
      and m.role = 'director'
      and m.status = 'approved'
      and a.status = 'approved'
  )
$$;

create function public.is_academy_member(p_academy_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_members m
    where m.academy_id = p_academy_id and m.user_id = auth.uid()
  )
$$;

-- ── 읽기 권한 ──

alter table public.academies enable row level security;
alter table public.academy_members enable row level security;

create policy "학원은 등록한 원장·소속(신청 포함) 회원·운영자가 본다"
on public.academies for select
to authenticated
using (owner_id = auth.uid() or public.is_academy_member(id) or public.is_admin());

create policy "소속 정보는 본인·그 학원 원장·운영자가 본다"
on public.academy_members for select
to authenticated
using (user_id = auth.uid() or public.is_academy_director(academy_id) or public.is_admin());

revoke all on public.academies, public.academy_members from anon;
revoke insert, update, delete on public.academies, public.academy_members from authenticated;

-- ── 쓰기 함수 ──

create function public.new_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6)
$$;

-- 원장: 학원 등록 (운영자 승인 대기 상태로 생성, 본인은 원장으로 소속)
create function public.register_academy(p_name text, p_phone text default null, p_address text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and member_type = 'director') then
    raise exception '원장 회원만 학원을 등록할 수 있습니다.' using errcode = '42501';
  end if;
  if (select count(*) from public.academies where owner_id = auth.uid() and status = 'pending') >= 3 then
    raise exception '승인 대기 중인 학원이 너무 많습니다.' using errcode = 'P0001';
  end if;

  for i in 1..5 loop
    begin
      insert into public.academies (name, phone, address, join_code, owner_id)
      values (btrim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), nullif(btrim(p_address), ''), public.new_join_code(), auth.uid())
      returning id into v_id;
      exit;
    exception when unique_violation then
      if i = 5 then raise; end if; -- 코드가 겹치면 새 코드로 다시
    end;
  end loop;

  insert into public.academy_members (academy_id, user_id, role, status, decided_at, decided_by)
  values (v_id, auth.uid(), 'director', 'approved', now(), auth.uid());
  return v_id;
end;
$$;

-- 운영자: 학원 승인/거절
create function public.review_academy(p_academy_id bigint, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '운영자만 학원을 승인할 수 있습니다.' using errcode = '42501';
  end if;
  update public.academies
  set status = case when p_approve then 'approved' else 'rejected' end,
      review_note = nullif(btrim(p_note), ''),
      reviewed_at = now()
  where id = p_academy_id;
  if not found then
    raise exception '학원을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
end;
$$;

-- 가입 신청 전: 코드로 학원 이름 확인 (승인된 학원만)
create function public.find_academy_by_code(p_code text)
returns table (id bigint, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name from public.academies a
  where a.join_code = upper(btrim(p_code)) and a.status = 'approved'
$$;

-- 학원 가입 신청 (강사·학부모·학생). 거절됐던 곳은 다시 신청할 수 있다.
create function public.request_academy_join(p_code text, p_role text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy_id bigint;
  v_status text;
begin
  if p_role not in ('teacher', 'parent', 'student') then
    raise exception '가입할 수 없는 역할입니다.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception '회원가입을 먼저 해 주세요.' using errcode = '42501';
  end if;

  select id into v_academy_id from public.academies
  where join_code = upper(btrim(p_code)) and status = 'approved';
  if v_academy_id is null then
    raise exception '학원 코드를 확인해 주세요.' using errcode = 'P0002';
  end if;

  select status into v_status from public.academy_members
  where academy_id = v_academy_id and user_id = auth.uid();
  if v_status in ('pending', 'approved') then
    raise exception '이미 가입했거나 신청한 학원입니다.' using errcode = '23505';
  end if;

  insert into public.academy_members (academy_id, user_id, role, status, requested_at)
  values (v_academy_id, auth.uid(), p_role, 'pending', now())
  on conflict (academy_id, user_id) do update
    set role = excluded.role, status = 'pending', requested_at = now(), decided_at = null, decided_by = null;
  return v_academy_id;
end;
$$;

-- 원장: 가입 신청 승인/거절
create function public.decide_academy_member(p_academy_id bigint, p_user_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_academy_director(p_academy_id) then
    raise exception '이 학원의 원장만 처리할 수 있습니다.' using errcode = '42501';
  end if;
  update public.academy_members
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now(),
      decided_by = auth.uid()
  where academy_id = p_academy_id and user_id = p_user_id and status = 'pending' and role <> 'director';
  if not found then
    raise exception '처리할 신청이 없습니다.' using errcode = 'P0002';
  end if;
end;
$$;

-- 원장: 학원 코드 새로 만들기 (코드가 퍼졌을 때)
create function public.regenerate_join_code(p_academy_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_academy_director(p_academy_id) then
    raise exception '이 학원의 원장만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  for i in 1..5 loop
    begin
      update public.academies set join_code = public.new_join_code()
      where id = p_academy_id returning join_code into v_code;
      return v_code;
    exception when unique_violation then
      if i = 5 then raise; end if;
    end;
  end loop;
end;
$$;

-- 원장·운영자: 소속 회원 목록 (이름·연락처 포함). profiles 는 본인만 읽을 수 있어서 함수로 제공한다.
create function public.academy_member_list(p_academy_id bigint)
returns table (
  user_id uuid,
  name text,
  phone text,
  role text,
  status text,
  requested_at timestamptz,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_academy_director(p_academy_id) or public.is_admin()) then
    raise exception '이 학원의 원장만 볼 수 있습니다.' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.name, p.phone, m.role, m.status, m.requested_at, m.decided_at
    from public.academy_members m
    join public.profiles p on p.id = m.user_id
    where m.academy_id = p_academy_id
    order by (m.status = 'pending') desc, m.requested_at desc;
end;
$$;

-- 실행 권한: 로그인한 사용자만 (각 함수 안에서 역할을 다시 확인)
revoke execute on function
  public.new_join_code(),
  public.register_academy(text, text, text),
  public.review_academy(bigint, boolean, text),
  public.find_academy_by_code(text),
  public.request_academy_join(text, text),
  public.decide_academy_member(bigint, uuid, boolean),
  public.regenerate_join_code(bigint),
  public.academy_member_list(bigint),
  public.is_academy_director(bigint),
  public.is_academy_member(bigint)
from public, anon;

grant execute on function
  public.register_academy(text, text, text),
  public.review_academy(bigint, boolean, text),
  public.find_academy_by_code(text),
  public.request_academy_join(text, text),
  public.decide_academy_member(bigint, uuid, boolean),
  public.regenerate_join_code(bigint),
  public.academy_member_list(bigint),
  public.is_academy_director(bigint),
  public.is_academy_member(bigint)
to authenticated;
