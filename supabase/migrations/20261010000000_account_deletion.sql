-- 회원 탈퇴
-- 로그인 계정(auth.users)을 지우면 회원 정보·학원 소속·알림·네이버 연결이 함께 지워진다 (on delete cascade).
-- 학원이 관리하는 기록(학생 명단·출석)은 학원 것이라 남는다. 작성한 공지·출석 체크 기록은 작성자만 비워진다 (set null).
-- 탈퇴할 수 없는 경우: 운영 중인(승인된) 학원의 원장, 운영자 권한이 있는 계정

-- 원장에게 보내는 '회원 탈퇴' 알림 종류 추가
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('attendance', 'join_request', 'membership', 'academy_request', 'academy_review', 'academy_message', 'member_left'));

-- 탈퇴를 막는 이유 목록 (비어 있으면 탈퇴 가능)
create function public.account_deletion_blockers()
returns table (reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select '운영자 권한이 있는 계정이에요. 다른 운영자에게 권한을 넘기고 해제한 뒤 탈퇴해 주세요.'
  from auth.users u
  where u.id = auth.uid() and u.raw_app_meta_data ->> 'role' = 'admin'
  union all
  select format('운영 중인 학원(%s)의 원장이에요. 운영자에게 학원 정리를 요청해 주세요.', a.name)
  from public.academies a
  where a.owner_id = auth.uid() and a.status = 'approved'
$$;

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_blocker text;
  v_membership record;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  select reason into v_blocker from public.account_deletion_blockers() limit 1;
  if v_blocker is not null then
    raise exception '%', v_blocker using errcode = 'P0001';
  end if;

  -- 소속 학원 원장에게 알림 (승인된 소속만)
  select name into v_name from public.profiles where id = v_uid;
  for v_membership in
    select m.academy_id, m.role, a.name as academy_name
    from public.academy_members m
    join public.academies a on a.id = m.academy_id
    where m.user_id = v_uid and m.status = 'approved' and m.role <> 'director'
  loop
    perform public.notify_users(
      (select array_agg(user_id) from public.academy_members
       where academy_id = v_membership.academy_id and role = 'director' and status = 'approved'),
      v_membership.academy_id,
      'member_left',
      format('회원 탈퇴: %s (%s)', coalesce(v_name, '회원'),
        case v_membership.role when 'teacher' then '강사' when 'parent' then '학부모' else '학생' end),
      v_membership.academy_name,
      format('/academies/%s', v_membership.academy_id)
    );
  end loop;

  -- 승인 대기·거절된 학원은 함께 정리 (owner_id 가 on delete restrict 이므로 먼저 지운다)
  delete from public.academies where owner_id = v_uid and status <> 'approved';

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.account_deletion_blockers(), public.delete_my_account() from public, anon;
grant execute on function public.account_deletion_blockers(), public.delete_my_account() to authenticated;
