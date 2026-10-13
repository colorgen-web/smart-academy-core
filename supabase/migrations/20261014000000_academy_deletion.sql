-- 학원 삭제(폐원)
-- 학원을 등록한 원장(owner) 또는 운영자가, 학원 이름을 한 번 더 입력해 확인한 뒤 지운다.
-- 학원에 딸린 소속·학생 명단·반·시간표·출석·수업 이해도·게시판·학원 알림이 함께 지워진다 (on delete cascade).
-- 지우기 전에 승인된 소속 회원에게 "폐원" 알림을 남긴다 (학원과 연결하지 않아 함께 지워지지 않는다).
-- (academy_board 다음에 실행)

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('attendance', 'join_request', 'membership', 'academy_request', 'academy_review', 'academy_message', 'member_left', 'lesson_feedback', 'academy_post', 'post_comment', 'academy_closed'));

create function public.delete_academy(p_academy_id bigint, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy public.academies;
  v_recipients uuid[];
begin
  select * into v_academy from public.academies where id = p_academy_id;
  if not found then
    raise exception '없는 학원입니다.' using errcode = 'P0002';
  end if;
  if v_academy.owner_id is distinct from auth.uid() and not public.is_admin() then
    raise exception '학원을 등록한 원장이나 운영자만 삭제할 수 있습니다.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_confirm_name, '')) <> v_academy.name then
    raise exception '학원 이름이 맞지 않습니다.' using errcode = '22023';
  end if;

  select array_agg(user_id) into v_recipients
  from public.academy_members
  where academy_id = p_academy_id and status = 'approved' and user_id <> auth.uid();

  perform public.notify_users(
    coalesce(v_recipients, '{}'), null, 'academy_closed',
    format('%s 학원이 삭제되었어요', v_academy.name),
    '학원의 반·출석·게시판 정보는 더 이상 볼 수 없어요.',
    '/'
  );

  delete from public.academies where id = p_academy_id;
end;
$$;

revoke execute on function public.delete_academy(bigint, text) from public, anon;
grant execute on function public.delete_academy(bigint, text) to authenticated;

-- 탈퇴 안내: 이제 원장이 직접 학원을 삭제할 수 있다
create or replace function public.account_deletion_blockers()
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
  select format('운영 중인 학원(%s)의 원장이에요. 학원 상세 맨 아래에서 학원을 먼저 삭제해 주세요.', a.name)
  from public.academies a
  where a.owner_id = auth.uid() and a.status = 'approved'
$$;
