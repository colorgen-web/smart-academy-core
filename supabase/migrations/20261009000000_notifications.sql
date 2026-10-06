-- 알림
-- 알림은 사용자가 직접 만들 수 없고, 아래 트리거·함수(security definer)만 만든다.
--   출석: 오늘 출석이 체크·변경되면 연결된 학부모·학생 본인에게
--   가입 신청: 학원 원장에게 / 승인·거절: 신청자에게
--   학원 등록: 운영자에게 / 학원 승인·거절: 등록한 원장에게
--   학원 알림: 원장이 고른 역할의 소속 회원에게 (send_academy_message)

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  academy_id bigint references public.academies (id) on delete cascade,
  type text not null check (type in ('attendance', 'join_request', 'membership', 'academy_request', 'academy_review', 'academy_message')),
  title text not null check (char_length(title) between 1 and 100),
  body text check (body is null or char_length(body) <= 1000),
  link text check (link is null or link ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc, id desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "알림: 본인 것만 본다" on public.notifications for select to authenticated
using (user_id = auth.uid());
create policy "알림: 본인 것만 읽음 처리" on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "알림: 본인 것만 지운다" on public.notifications for delete to authenticated
using (user_id = auth.uid());

revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ── 내부용: 여러 명에게 같은 알림 넣기 (직접 호출 불가) ──
create function public.notify_users(
  p_user_ids uuid[],
  p_academy_id bigint,
  p_type text,
  p_title text,
  p_body text,
  p_link text
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with inserted as (
    insert into public.notifications (user_id, academy_id, type, title, body, link)
    select distinct u, p_academy_id, p_type, left(p_title, 100), left(p_body, 1000), p_link
    from unnest(p_user_ids) as u
    where u is not null
    returning 1
  )
  select count(*)::integer from inserted
$$;

revoke execute on function public.notify_users(uuid[], bigint, text, text, text, text) from public, anon, authenticated;

-- ── 출석 알림 ──
create function public.attendance_notify()
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
  where (m.role = 'parent' and p.phone = any (v_student.guardian_phones))
     or (m.role = 'student' and p.phone = v_student.student_phone);

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

create trigger attendance_notify after insert or update of status on public.attendance
for each row execute function public.attendance_notify();

-- ── 가입 신청·승인 알림 ──
create function public.membership_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy_name text;
  v_name text;
  v_role_label text;
  v_directors uuid[];
begin
  select name into v_academy_name from public.academies where id = new.academy_id;
  v_role_label := case new.role
    when 'director' then '원장' when 'teacher' then '강사' when 'parent' then '학부모' else '학생' end;

  -- 새 신청(또는 거절 후 재신청) → 원장에게
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    select name into v_name from public.profiles where id = new.user_id;
    select array_agg(user_id) into v_directors from public.academy_members
    where academy_id = new.academy_id and role = 'director' and status = 'approved';
    perform public.notify_users(
      v_directors, new.academy_id, 'join_request',
      format('새 가입 신청: %s (%s)', coalesce(v_name, '회원'), v_role_label),
      v_academy_name,
      format('/academies/%s', new.academy_id)
    );
  -- 승인·거절 → 신청자에게 (원장 본인 등록 시 자동 승인은 제외)
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.notify_users(
      array[new.user_id], new.academy_id, 'membership',
      format('%s 가입이 %s', v_academy_name, case when new.status = 'approved' then '승인되었어요' else '승인되지 않았어요' end),
      case when new.status = 'approved' then format('%s(으)로 이용할 수 있어요.', v_role_label) else '자세한 내용은 학원에 문의해 주세요.' end,
      format('/academies/%s', new.academy_id)
    );
  end if;
  return null;
end;
$$;

create trigger membership_notify after insert or update of status on public.academy_members
for each row execute function public.membership_notify();

-- ── 학원 등록·승인 알림 ──
create function public.academy_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admins uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(id) into v_admins from auth.users where raw_app_meta_data ->> 'role' = 'admin';
    perform public.notify_users(
      v_admins, new.id, 'academy_request',
      format('새 학원 등록 신청: %s', new.name), '운영자 승인이 필요해요.', '/admin/academies'
    );
  elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.notify_users(
      array[new.owner_id], new.id, 'academy_review',
      format('%s 등록이 %s', new.name, case when new.status = 'approved' then '승인되었어요' else '승인되지 않았어요' end),
      case when new.status = 'approved' then '학원 코드로 강사·학부모·학생을 받을 수 있어요.'
           else coalesce('사유: ' || new.review_note, '자세한 내용은 운영자에게 문의해 주세요.') end,
      format('/academies/%s', new.id)
    );
  end if;
  return null;
end;
$$;

create trigger academy_notify after insert or update of status on public.academies
for each row execute function public.academy_notify();

revoke execute on function
  public.attendance_notify(), public.membership_notify(), public.academy_notify()
from public, anon, authenticated;

-- ── 원장: 학원 알림 보내기 ──
-- p_roles: 받을 역할 ('teacher' | 'parent' | 'student') 배열. 보낸 사람은 받지 않는다. 받은 사람 수를 돌려준다.
create function public.send_academy_message(p_academy_id bigint, p_title text, p_body text, p_roles text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_recipients uuid[];
begin
  if not public.is_academy_director(p_academy_id) then
    raise exception '이 학원의 원장만 알림을 보낼 수 있습니다.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception '제목을 입력해 주세요.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_roles), 0) = 0 or not (p_roles <@ array['teacher', 'parent', 'student']) then
    raise exception '받을 대상을 골라 주세요.' using errcode = '22023';
  end if;
  -- 학원당 하루 20건까지 (실수·남용 방지)
  if (select count(distinct created_at) from public.notifications
      where academy_id = p_academy_id and type = 'academy_message'
        and created_at > now() - interval '1 day') >= 20 then
    raise exception '오늘은 더 이상 알림을 보낼 수 없습니다.' using errcode = 'P0001';
  end if;

  select name into v_name from public.academies where id = p_academy_id;
  select array_agg(user_id) into v_recipients from public.academy_members
  where academy_id = p_academy_id and status = 'approved' and role = any (p_roles) and user_id <> auth.uid();

  return public.notify_users(
    coalesce(v_recipients, '{}'), p_academy_id, 'academy_message',
    format('[%s] %s', v_name, btrim(p_title)), nullif(btrim(p_body), ''), '/notices'
  );
end;
$$;

revoke execute on function public.send_academy_message(bigint, text, text, text[]) from public, anon;
grant execute on function public.send_academy_message(bigint, text, text, text[]) to authenticated;
