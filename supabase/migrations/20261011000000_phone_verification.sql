-- 휴대폰 문자 인증
-- 인증번호 발송·확인은 Edge Function(phone-verify)이 하고, 확인되면 phone_verifications 에 기록한다.
-- profiles.phone 을 넣거나 바꿀 때 최근 30분 안에 인증된 번호면 phone_verified_at 을 채운다.
--
-- 인증 필수 여부는 app_settings.phone_verification_required 로 켜고 끈다 (기본: 끔).
--   끔: 지금처럼 동작. 인증은 선택.
--   켬: 회원가입·번호 변경에 인증 필수, 학부모·학생 자녀 연결(자녀 정보·출석 알림)은 인증된 번호만.
--   켜기: update public.app_settings set value = 'true' where key = 'phone_verification_required';

-- ── 앱 설정 ──
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
create policy "앱 설정: 로그인한 사용자는 읽을 수 있다" on public.app_settings for select to authenticated using (true);
revoke all on public.app_settings from anon;
revoke insert, update, delete on public.app_settings from authenticated;

insert into public.app_settings (key, value) values ('phone_verification_required', 'false');

create function public.phone_verification_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'phone_verification_required'), false)
$$;

-- 자녀 연결에 쓸 수 있는 번호인가 (인증 필수일 때는 인증된 번호만)
create function public.phone_link_allowed(p_verified_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_verified_at is not null or not public.phone_verification_required()
$$;

-- ── 인증 기록 (Edge Function 전용: RLS 켜고 정책 없음) ──
alter table public.profiles add column phone_verified_at timestamptz;

create table public.phone_verifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null check (phone ~ '^01[016789][0-9]{7,8}$'),
  code_hash text not null,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index phone_verifications_user_idx on public.phone_verifications (user_id, created_at desc);
create index phone_verifications_phone_idx on public.phone_verifications (phone, created_at desc);
create index phone_verifications_created_idx on public.phone_verifications (created_at);

alter table public.phone_verifications enable row level security;
revoke all on public.phone_verifications from anon, authenticated;

-- ── 번호를 넣거나 바꿀 때 인증 확인 ──
create function public.profiles_check_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.phone_verifications
    where user_id = new.id and phone = new.phone and verified_at > now() - interval '30 minutes'
  ) then
    new.phone_verified_at := now();
  elsif tg_op = 'UPDATE' and new.phone = old.phone then
    new.phone_verified_at := old.phone_verified_at;
  else
    new.phone_verified_at := null;
    -- 운영자가 SQL 로 직접 고치는 경우(auth.uid() 없음)는 막지 않는다
    if public.phone_verification_required() and auth.uid() is not null then
      raise exception '휴대폰 인증이 필요합니다.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_check_phone_verified
before insert or update of phone on public.profiles
for each row execute function public.profiles_check_phone_verified();

-- ── 자녀 연결·출석 알림: 인증 필수일 때는 인증된 번호만 ──
create or replace function public.my_student_ids()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  join public.profiles p on p.id = auth.uid()
  join public.academy_members m
    on m.academy_id = s.academy_id and m.user_id = auth.uid() and m.status = 'approved'
  join public.academies a on a.id = s.academy_id and a.status = 'approved'
  where s.active
    and (
      (m.role = 'parent' and p.phone = any (s.guardian_phones))
      or (m.role = 'student' and s.student_phone = p.phone)
    )
    and public.phone_link_allowed(p.phone_verified_at)
$$;

create or replace function public.attendance_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student record;
  v_class record;
  v_label text;
  v_recipients uuid[];
begin
  if tg_op = 'UPDATE' and old.status = new.status then
    return null;
  end if;
  -- 지난 날짜를 고칠 때는 알리지 않는다 (오늘 수업만)
  if new.date <> (now() at time zone 'Asia/Seoul')::date then
    return null;
  end if;

  select id, name, guardian_phones, student_phone, academy_id into v_student
  from public.students where id = new.student_id and active;
  if not found then
    return null;
  end if;
  select c.name, a.name as academy_name into v_class
  from public.classes c join public.academies a on a.id = c.academy_id
  where c.id = new.class_id;

  select array_agg(p.id) into v_recipients
  from public.profiles p
  join public.academy_members m
    on m.user_id = p.id and m.academy_id = v_student.academy_id and m.status = 'approved'
  where ((m.role = 'parent' and p.phone = any (v_student.guardian_phones))
      or (m.role = 'student' and p.phone = v_student.student_phone))
    and public.phone_link_allowed(p.phone_verified_at);

  if v_recipients is null then
    return null;
  end if;

  v_label := case new.status
    when 'present' then '출석' when 'late' then '지각' when 'absent' then '결석' else '사유 결석' end;

  perform public.notify_users(
    v_recipients,
    v_student.academy_id,
    'attendance',
    format('%s %s', v_student.name, v_label),
    format('%s · %s', v_class.academy_name, v_class.name) || coalesce(' · ' || new.note, ''),
    '/attendance'
  );
  return null;
end;
$$;

revoke execute on function public.phone_link_allowed(timestamptz), public.profiles_check_phone_verified() from public, anon;
grant execute on function public.phone_link_allowed(timestamptz) to authenticated;
revoke execute on function public.phone_verification_required() from public, anon;
grant execute on function public.phone_verification_required() to authenticated;
