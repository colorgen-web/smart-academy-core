-- 수업 이해도 (학생 자기 평가)
-- 학생 계정이 자기 수업에 이해도(1~5)와 코멘트를 남긴다. 원장·강사와 학부모는 보기만 한다.
-- 남길 수 있는 수업: 본인이 듣는 운영 중인 반, 그 반 시간표 요일의 오늘 ~ 6일 전 수업, 결석·사유 결석이 아닌 날
-- 처음 남기면 학부모에게 알림이 간다.

-- 알림 종류 추가
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('attendance', 'join_request', 'membership', 'academy_request', 'academy_review', 'academy_message', 'member_left', 'lesson_feedback'));

create table public.lesson_feedback (
  class_id bigint not null references public.classes (id) on delete cascade,
  student_id bigint not null references public.students (id) on delete cascade,
  date date not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 200),
  written_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, student_id, date)
);

create index lesson_feedback_student_idx on public.lesson_feedback (student_id, date desc);
create index lesson_feedback_class_date_idx on public.lesson_feedback (class_id, date);

alter table public.lesson_feedback enable row level security;
create policy "이해도: 원장·강사·연결된 가족이 본다" on public.lesson_feedback for select to authenticated
using (public.is_academy_staff(public.class_academy(class_id)) or student_id in (select public.my_student_ids()));
-- 쓰기는 set_lesson_feedback 함수로만
revoke all on public.lesson_feedback from anon;
revoke insert, update, delete on public.lesson_feedback from authenticated;

-- 학생 본인으로 연결된 학생 id (학부모 연결은 빼고)
create function public.my_own_student_ids()
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
    on m.academy_id = s.academy_id and m.user_id = auth.uid() and m.status = 'approved' and m.role = 'student'
  join public.academies a on a.id = s.academy_id and a.status = 'approved'
  where s.active
    and s.student_phone = p.phone
    and public.phone_link_allowed(p.phone_verified_at)
$$;

-- 이해도 남기기 / 고치기 / 지우기(p_rating null)
create function public.set_lesson_feedback(
  p_class_id bigint,
  p_student_id bigint,
  p_date date,
  p_rating smallint,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_student_id not in (select public.my_own_student_ids()) then
    raise exception '학생 본인만 수업 이해도를 남길 수 있습니다.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.class_students cs join public.classes c on c.id = cs.class_id
    where cs.class_id = p_class_id and cs.student_id = p_student_id and c.active
  ) then
    raise exception '듣고 있는 수업이 아닙니다.' using errcode = 'P0002';
  end if;
  if p_date > v_today or p_date < v_today - 6 then
    raise exception '최근 7일 안의 수업만 남길 수 있습니다.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.class_schedules where class_id = p_class_id and weekday = extract(dow from p_date)
  ) then
    raise exception '그날은 수업이 없는 날입니다.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.attendance
    where class_id = p_class_id and student_id = p_student_id and date = p_date and status in ('absent', 'excused')
  ) then
    raise exception '결석한 수업은 남길 수 없습니다.' using errcode = '22023';
  end if;

  if p_rating is null then
    delete from public.lesson_feedback where class_id = p_class_id and student_id = p_student_id and date = p_date;
    return;
  end if;

  insert into public.lesson_feedback (class_id, student_id, date, rating, comment, written_by)
  values (p_class_id, p_student_id, p_date, p_rating, nullif(btrim(p_comment), ''), auth.uid())
  on conflict (class_id, student_id, date) do update
    set rating = excluded.rating, comment = excluded.comment, written_by = excluded.written_by, updated_at = now();
end;
$$;

-- 처음 남기면 학부모에게 알림
create function public.lesson_feedback_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student record;
  v_class record;
  v_recipients uuid[];
begin
  select name, guardian_phones, academy_id into v_student from public.students where id = new.student_id;
  select c.name, a.name as academy_name into v_class
  from public.classes c join public.academies a on a.id = c.academy_id
  where c.id = new.class_id;

  select array_agg(p.id) into v_recipients
  from public.profiles p
  join public.academy_members m
    on m.user_id = p.id and m.academy_id = v_student.academy_id and m.status = 'approved' and m.role = 'parent'
  where p.phone = any (v_student.guardian_phones)
    and public.phone_link_allowed(p.phone_verified_at);

  if v_recipients is null then
    return null;
  end if;

  perform public.notify_users(
    v_recipients,
    v_student.academy_id,
    'lesson_feedback',
    format('%s 수업 이해도 %s', v_student.name,
      case new.rating when 1 then '1단계 · 전혀 모르겠어요' when 2 then '2단계 · 조금 어려워요'
        when 3 then '3단계 · 보통이에요' when 4 then '4단계 · 대부분 이해했어요' else '5단계 · 완벽히 이해했어요' end),
    format('%s · %s', v_class.academy_name, v_class.name) || coalesce(' · "' || new.comment || '"', ''),
    format('/classes/%s', new.class_id)
  );
  return null;
end;
$$;

create trigger lesson_feedback_notify after insert on public.lesson_feedback
for each row execute function public.lesson_feedback_notify();

revoke execute on function public.lesson_feedback_notify() from public, anon, authenticated;
revoke execute on function
  public.my_own_student_ids(),
  public.set_lesson_feedback(bigint, bigint, date, smallint, text)
from public, anon;
grant execute on function
  public.my_own_student_ids(),
  public.set_lesson_feedback(bigint, bigint, date, smallint, text)
to authenticated;
