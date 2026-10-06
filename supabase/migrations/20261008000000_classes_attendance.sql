-- 학생 명단 · 반 · 시간표 · 출석
--   학생(students): 학원별 명단. 계정이 없어도 된다 (14세 미만 자녀 등). 원장이 관리.
--   학부모 연결: students.guardian_phones 에 학부모 휴대폰을 넣어 두면, 그 번호로 가입하고
--               이 학원에 학부모로 승인된 회원이 자기 자녀 정보(반·시간표·출석)를 볼 수 있다.
--               (학생 본인 계정은 student_phone + 학생 승인으로 같은 방식)
--   반(classes) + 시간표(class_schedules): 원장이 관리. 수강생은 class_students.
--   출석(attendance): 반·학생·날짜마다 1건. 원장·강사가 체크.
--   반 저장(save_class)과 출석 체크(set_attendance)는 함수로만 한다.

-- ── 도우미 ──

create function public.valid_phone_list(p_phones text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_phones), 0) <= 3
     and coalesce(bool_and(x ~ '^01[016789][0-9]{7,8}$'), true)
  from unnest(p_phones) as x
$$;

-- 이 학원의 원장·강사(승인된 학원, 승인된 소속)인가
create function public.is_academy_staff(p_academy_id bigint)
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
      and m.role in ('director', 'teacher')
      and m.status = 'approved'
      and a.status = 'approved'
  )
$$;

-- ── 테이블 ──

create table public.students (
  id bigint generated always as identity primary key,
  academy_id bigint not null references public.academies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  grade text check (grade is null or char_length(grade) <= 20),
  school text check (school is null or char_length(school) <= 40),
  student_phone text check (student_phone is null or student_phone ~ '^01[016789][0-9]{7,8}$'),
  guardian_phones text[] not null default '{}' check (public.valid_phone_list(guardian_phones)),
  memo text check (memo is null or char_length(memo) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_academy_idx on public.students (academy_id, active, name);
create index students_guardian_idx on public.students using gin (guardian_phones);

create table public.classes (
  id bigint generated always as identity primary key,
  academy_id bigint not null references public.academies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  subject text check (subject is null or char_length(subject) <= 30),
  room text check (room is null or char_length(room) <= 30),
  teacher_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classes_academy_idx on public.classes (academy_id, active);

-- weekday: 0=일 1=월 … 6=토 (JavaScript Date.getDay 와 같다)
create table public.class_schedules (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  unique (class_id, weekday, start_time)
);

create table public.class_students (
  class_id bigint not null references public.classes (id) on delete cascade,
  student_id bigint not null references public.students (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index class_students_student_idx on public.class_students (student_id);

create table public.attendance (
  class_id bigint not null references public.classes (id) on delete cascade,
  student_id bigint not null references public.students (id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  note text check (note is null or char_length(note) <= 100),
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz not null default now(),
  primary key (class_id, student_id, date)
);

create index attendance_student_idx on public.attendance (student_id, date desc);
create index attendance_class_date_idx on public.attendance (class_id, date);

create trigger students_touch_updated_at before update on public.students
for each row execute function public.touch_updated_at();
create trigger classes_touch_updated_at before update on public.classes
for each row execute function public.touch_updated_at();

-- ── 연관 확인 함수 (RLS 재귀 방지용 security definer) ──

create function public.class_academy(p_class_id bigint)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select academy_id from public.classes where id = p_class_id
$$;

-- 내가 볼 수 있는 학생 (학부모: 연락처 일치 / 학생: 본인 번호 일치, 둘 다 그 학원에 승인된 소속일 때)
create function public.my_student_ids()
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
$$;

-- 학원 소속 회원이면 그 학원 원장·강사 이름을 볼 수 있다 (반 담당 강사 표시용)
create function public.academy_staff_names(p_academy_id bigint)
returns table (user_id uuid, name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, p.name, m.role
  from public.academy_members m
  join public.profiles p on p.id = m.user_id
  where m.academy_id = p_academy_id
    and m.role in ('director', 'teacher')
    and m.status = 'approved'
    and exists (
      select 1 from public.academy_members me
      where me.academy_id = p_academy_id and me.user_id = auth.uid() and me.status = 'approved'
    )
$$;

-- ── 무결성 트리거 ──

-- 담당 강사는 그 학원의 승인된 원장·강사여야 한다
create function public.classes_check_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.teacher_id is not null and not exists (
    select 1 from public.academy_members
    where academy_id = new.academy_id and user_id = new.teacher_id
      and role in ('director', 'teacher') and status = 'approved'
  ) then
    raise exception '담당 강사는 이 학원의 원장·강사여야 합니다.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger classes_check_teacher before insert or update of teacher_id on public.classes
for each row execute function public.classes_check_teacher();

-- 수강생은 같은 학원 학생이어야 한다
create function public.class_students_same_academy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select academy_id from public.students where id = new.student_id)
     is distinct from (select academy_id from public.classes where id = new.class_id) then
    raise exception '같은 학원의 학생만 반에 넣을 수 있습니다.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger class_students_same_academy before insert on public.class_students
for each row execute function public.class_students_same_academy();


-- ── 쓰기 함수 ──

-- 원장: 반 만들기/수정 + 시간표 통째로 바꾸기 (p_id 가 null 이면 새 반)
-- p_schedules: [{"weekday":1,"start":"16:00","end":"17:30"}, …]
create function public.save_class(
  p_id bigint,
  p_academy_id bigint,
  p_name text,
  p_subject text,
  p_room text,
  p_teacher_id uuid,
  p_schedules jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint := p_id;
  v_academy bigint;
begin
  v_academy := coalesce(public.class_academy(p_id), p_academy_id);
  if p_id is not null and public.class_academy(p_id) is null then
    raise exception '반을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if not public.is_academy_director(v_academy) then
    raise exception '이 학원의 원장만 반을 관리할 수 있습니다.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_schedules, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_schedules, '[]'::jsonb)) > 14 then
    raise exception '시간표 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.classes (academy_id, name, subject, room, teacher_id)
    values (v_academy, btrim(p_name), nullif(btrim(p_subject), ''), nullif(btrim(p_room), ''), p_teacher_id)
    returning id into v_id;
  else
    update public.classes
    set name = btrim(p_name), subject = nullif(btrim(p_subject), ''), room = nullif(btrim(p_room), ''), teacher_id = p_teacher_id
    where id = v_id;
  end if;

  delete from public.class_schedules where class_id = v_id;
  insert into public.class_schedules (class_id, weekday, start_time, end_time)
  select v_id, (x ->> 'weekday')::smallint, (x ->> 'start')::time, (x ->> 'end')::time
  from jsonb_array_elements(coalesce(p_schedules, '[]'::jsonb)) as x;

  return v_id;
end;
$$;

-- 원장·강사: 출석 기록 (p_status 가 null 이면 기록 지우기)
create function public.set_attendance(
  p_class_id bigint,
  p_student_id bigint,
  p_date date,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_academy_staff(public.class_academy(p_class_id)) then
    raise exception '이 학원의 원장·강사만 출석을 체크할 수 있습니다.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.class_students where class_id = p_class_id and student_id = p_student_id) then
    raise exception '이 반의 수강생이 아닙니다.' using errcode = 'P0002';
  end if;
  if p_date > (now() at time zone 'Asia/Seoul')::date + 1 then
    raise exception '미래 날짜의 출석은 기록할 수 없습니다.' using errcode = '22023';
  end if;

  if p_status is null then
    delete from public.attendance where class_id = p_class_id and student_id = p_student_id and date = p_date;
    return;
  end if;

  insert into public.attendance (class_id, student_id, date, status, note, checked_by, checked_at)
  values (p_class_id, p_student_id, p_date, p_status, nullif(btrim(p_note), ''), auth.uid(), now())
  on conflict (class_id, student_id, date) do update
    set status = excluded.status, note = excluded.note, checked_by = excluded.checked_by, checked_at = excluded.checked_at;
end;
$$;

-- ── 권한 (RLS) ──

alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.class_schedules enable row level security;
alter table public.class_students enable row level security;
alter table public.attendance enable row level security;

-- 학생 명단: 원장·강사 / 연결된 학부모·학생 본인
create policy "학생: 원장·강사·연결된 가족이 본다" on public.students for select to authenticated
using (public.is_academy_staff(academy_id) or id in (select public.my_student_ids()));
create policy "학생: 원장이 등록" on public.students for insert to authenticated
with check (public.is_academy_director(academy_id));
create policy "학생: 원장이 수정" on public.students for update to authenticated
using (public.is_academy_director(academy_id)) with check (public.is_academy_director(academy_id));
create policy "학생: 원장이 삭제" on public.students for delete to authenticated
using (public.is_academy_director(academy_id));

-- 반: 원장·강사 / 자녀가 수강 중인 가족
create policy "반: 원장·강사·수강생 가족이 본다" on public.classes for select to authenticated
using (
  public.is_academy_staff(academy_id)
  or exists (
    select 1 from public.class_students cs
    where cs.class_id = classes.id and cs.student_id in (select public.my_student_ids())
  )
);
-- 반 만들기·수정은 save_class() 함수로 (시간표와 함께)
create policy "반: 원장이 보관/복원" on public.classes for update to authenticated
using (public.is_academy_director(academy_id)) with check (public.is_academy_director(academy_id));
create policy "반: 원장이 삭제" on public.classes for delete to authenticated
using (public.is_academy_director(academy_id));

-- 시간표: 반을 볼 수 있으면 본다 / 원장이 관리
create policy "시간표: 반을 볼 수 있으면 본다" on public.class_schedules for select to authenticated
using (exists (select 1 from public.classes c where c.id = class_id));
-- 시간표 쓰기는 save_class() 함수로만 (반 정보와 함께 한 번에 저장)

-- 수강생: 원장·강사 / 가족은 자기 자녀 것만
create policy "수강: 원장·강사·가족이 본다" on public.class_students for select to authenticated
using (public.is_academy_staff(public.class_academy(class_id)) or student_id in (select public.my_student_ids()));
create policy "수강: 원장이 추가" on public.class_students for insert to authenticated
with check (public.is_academy_director(public.class_academy(class_id)));
create policy "수강: 원장이 삭제" on public.class_students for delete to authenticated
using (public.is_academy_director(public.class_academy(class_id)));

-- 출석: 원장·강사가 체크 / 가족은 자기 자녀 것만 본다
create policy "출석: 원장·강사·가족이 본다" on public.attendance for select to authenticated
using (public.is_academy_staff(public.class_academy(class_id)) or student_id in (select public.my_student_ids()));
-- 출석 기록·수정·삭제는 set_attendance() 함수로만

-- 바꿀 수 있는 칸 제한 (학원 이동·기록자 위조 방지)
revoke all on public.students, public.classes, public.class_schedules, public.class_students, public.attendance from anon;
revoke update on public.students, public.classes, public.class_schedules, public.class_students, public.attendance from authenticated;
grant update (name, grade, school, student_phone, guardian_phones, memo, active) on public.students to authenticated;
revoke insert on public.classes from authenticated;
grant update (active) on public.classes to authenticated;
revoke insert, delete on public.class_schedules from authenticated;
revoke insert, delete on public.attendance from authenticated;

revoke execute on function
  public.save_class(bigint, bigint, text, text, text, uuid, jsonb),
  public.set_attendance(bigint, bigint, date, text, text),
  public.is_academy_staff(bigint),
  public.class_academy(bigint),
  public.my_student_ids(),
  public.academy_staff_names(bigint)
from public, anon;
grant execute on function
  public.save_class(bigint, bigint, text, text, text, uuid, jsonb),
  public.set_attendance(bigint, bigint, date, text, text),
  public.is_academy_staff(bigint),
  public.class_academy(bigint),
  public.my_student_ids(),
  public.academy_staff_names(bigint)
to authenticated;
