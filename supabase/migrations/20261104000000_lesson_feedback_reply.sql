-- 수업 이해도 강사 답변
-- 학생이 남긴 이해도에 그 학원 원장·강사가 답변을 단다 (한 기록에 답변 하나, 고치기·지우기 가능).
-- 답변을 새로 달거나 고치면 학생 본인과 학부모에게 알림이 간다.
-- 학생이 이해도를 지우면 답변도 함께 지워진다 (같은 행).

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('attendance', 'join_request', 'membership', 'academy_request', 'academy_review', 'academy_message', 'member_left', 'lesson_feedback', 'academy_post', 'post_comment', 'academy_closed', 'feedback_reply'));

alter table public.lesson_feedback
  add column reply text check (reply is null or char_length(reply) <= 300),
  add column reply_by uuid references auth.users (id) on delete set null,
  add column replied_at timestamptz;

-- 답변 달기 / 고치기 / 지우기(빈 값)
create function public.set_lesson_feedback_reply(
  p_class_id bigint,
  p_student_id bigint,
  p_date date,
  p_reply text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reply text := nullif(btrim(p_reply), '');
  v_row public.lesson_feedback;
  v_student record;
  v_class record;
  v_recipients uuid[];
begin
  if not public.is_academy_staff(public.class_academy(p_class_id)) then
    raise exception '그 학원 원장·강사만 답변을 달 수 있습니다.' using errcode = '42501';
  end if;
  if v_reply is not null and char_length(v_reply) > 300 then
    raise exception '답변은 300자까지 쓸 수 있습니다.' using errcode = '22023';
  end if;

  select * into v_row from public.lesson_feedback
  where class_id = p_class_id and student_id = p_student_id and date = p_date
  for update;
  if not found then
    raise exception '학생이 남긴 이해도가 없습니다.' using errcode = 'P0002';
  end if;

  update public.lesson_feedback
  set reply = v_reply,
      reply_by = case when v_reply is null then null else auth.uid() end,
      replied_at = case when v_reply is null then null else now() end
  where class_id = p_class_id and student_id = p_student_id and date = p_date;

  -- 지웠거나 내용이 그대로면 알림 없음
  if v_reply is null or v_reply is not distinct from v_row.reply then
    return;
  end if;

  select name, student_phone, guardian_phones, academy_id into v_student from public.students where id = p_student_id;
  select c.name, a.name as academy_name into v_class
  from public.classes c join public.academies a on a.id = c.academy_id
  where c.id = p_class_id;

  -- 학생 본인(학생 번호) + 학부모(보호자 번호), 그 학원에 승인된 소속만
  select array_agg(distinct p.id) into v_recipients
  from public.profiles p
  join public.academy_members m
    on m.user_id = p.id and m.academy_id = v_student.academy_id and m.status = 'approved'
  where public.phone_link_allowed(p.phone_verified_at)
    and (
      (m.role = 'student' and p.phone = v_student.student_phone)
      or (m.role = 'parent' and p.phone = any (v_student.guardian_phones))
    );

  if v_recipients is null then
    return;
  end if;

  perform public.notify_users(
    v_recipients,
    v_student.academy_id,
    'feedback_reply',
    format('%s 수업 이해도에 선생님 답변', v_student.name),
    format('%s · %s · "%s"', v_class.academy_name, v_class.name, left(v_reply, 60)),
    format('/classes/%s', p_class_id)
  );
end;
$$;

revoke execute on function public.set_lesson_feedback_reply(bigint, bigint, date, text) from public, anon;
grant execute on function public.set_lesson_feedback_reply(bigint, bigint, date, text) to authenticated;
