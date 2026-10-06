-- 관리자 공지사항
-- 읽기: 누구나 (게스트 둘러보기 포함)
-- 쓰기/수정/삭제: 관리자만 (auth.users.raw_app_meta_data.role = 'admin')
--   app_metadata 는 서비스 키로만 바꿀 수 있어 사용자가 스스로 관리자가 될 수 없다.

create table public.announcements (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 200),
  content text not null default '',
  is_pinned boolean not null default false,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is '관리자 공지사항 (메인 5개, 전체 목록 10개씩 페이징)';

-- 목록 정렬: 고정 공지 먼저, 그다음 최신순
create index announcements_list_idx on public.announcements (is_pinned desc, created_at desc, id desc);

create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger announcements_touch_updated_at
before update on public.announcements
for each row execute function public.touch_updated_at();

alter table public.announcements enable row level security;

create policy "공지사항은 누구나 읽을 수 있다"
on public.announcements for select
to anon, authenticated
using (true);

create policy "관리자만 공지사항을 작성할 수 있다"
on public.announcements for insert
to authenticated
with check (public.is_admin());

create policy "관리자만 공지사항을 수정할 수 있다"
on public.announcements for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "관리자만 공지사항을 삭제할 수 있다"
on public.announcements for delete
to authenticated
using (public.is_admin());
