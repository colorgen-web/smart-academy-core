-- 학원 공지·게시판
-- 공지(notice): 원장·강사가 쓴다. 받을 역할(강사·학부모·학생)을 고를 수 있고, 고정할 수 있고, 올리면 알림이 간다.
-- 게시글(general): 승인된 소속 회원 누구나 쓰고, 소속 회원 모두가 본다.
-- 댓글: 글을 볼 수 있는 사람이 단다. 글쓴이에게 알림.
-- 지우기: 본인 글·댓글, 또는 그 학원 원장. 회원 탈퇴 시 글은 남고 작성자만 비운다.
-- (notifications 다음에 실행)

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('attendance', 'join_request', 'membership', 'academy_request', 'academy_review', 'academy_message', 'member_left', 'lesson_feedback', 'academy_post', 'post_comment'));

-- 승인된 학원에서 승인된 내 역할 (없으면 null)
create function public.my_academy_role(p_academy_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.academy_members m
  join public.academies a on a.id = m.academy_id
  where m.academy_id = p_academy_id
    and m.user_id = auth.uid()
    and m.status = 'approved'
    and a.status = 'approved'
$$;

create table public.academy_posts (
  id bigint generated always as identity primary key,
  academy_id bigint not null references public.academies (id) on delete cascade,
  category text not null check (category in ('notice', 'general')),
  title text not null check (char_length(title) between 1 and 100),
  content text not null default '' check (char_length(content) <= 5000),
  is_pinned boolean not null default false,
  -- 공지를 볼 역할. 원장·강사는 항상 본다. 게시글은 항상 전체.
  audience text[] not null default '{teacher,parent,student}'
    check (cardinality(audience) > 0 and audience <@ array['teacher', 'parent', 'student']),
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category = 'notice' or not is_pinned)
);

create index academy_posts_list_idx on public.academy_posts (academy_id, is_pinned desc, created_at desc, id desc);

create trigger academy_posts_touch_updated_at
before update on public.academy_posts
for each row execute function public.touch_updated_at();

create table public.academy_post_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.academy_posts (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index academy_post_comments_post_idx on public.academy_post_comments (post_id, created_at, id);

-- 이 글을 볼 수 있는가
create function public.can_view_academy_post(p_academy_id bigint, p_category text, p_audience text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.my_academy_role(p_academy_id)
    when 'director' then true
    when 'teacher' then true
    when 'parent' then p_category = 'general' or 'parent' = any (p_audience)
    when 'student' then p_category = 'general' or 'student' = any (p_audience)
    else false
  end
$$;

create function public.post_academy(p_post_id bigint)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select academy_id from public.academy_posts where id = p_post_id
$$;

-- ── 권한 (RLS) ──

alter table public.academy_posts enable row level security;
alter table public.academy_post_comments enable row level security;

create policy "학원 글: 볼 수 있는 소속 회원" on public.academy_posts for select to authenticated
using (public.can_view_academy_post(academy_id, category, audience));
create policy "학원 글: 본인 또는 원장이 지운다" on public.academy_posts for delete to authenticated
using (author_id = auth.uid() or public.is_academy_director(academy_id));

create policy "댓글: 글을 볼 수 있으면 본다" on public.academy_post_comments for select to authenticated
using (exists (select 1 from public.academy_posts p where p.id = post_id));
create policy "댓글: 글을 볼 수 있으면 단다" on public.academy_post_comments for insert to authenticated
with check (author_id = auth.uid() and exists (select 1 from public.academy_posts p where p.id = post_id));
create policy "댓글: 본인 또는 원장이 지운다" on public.academy_post_comments for delete to authenticated
using (author_id = auth.uid() or public.is_academy_director(public.post_academy(post_id)));

revoke all on public.academy_posts, public.academy_post_comments from anon;
-- 글 쓰기·고치기는 save_academy_post() 로만
revoke insert, update on public.academy_posts from authenticated;
revoke update on public.academy_post_comments from authenticated;
revoke insert on public.academy_post_comments from authenticated;
grant insert (post_id, content) on public.academy_post_comments to authenticated;

-- ── 쓰기 함수 ──

-- 새 글(p_id null) 또는 본인 글 고치기. 글 id 를 돌려준다.
create function public.save_academy_post(
  p_id bigint,
  p_academy_id bigint,
  p_category text,
  p_title text,
  p_content text,
  p_pinned boolean default false,
  p_audience text[] default '{teacher,parent,student}'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_post public.academy_posts;
  v_id bigint;
begin
  if p_id is not null then
    select * into v_post from public.academy_posts where id = p_id;
    if not found or v_post.author_id is distinct from auth.uid() then
      raise exception '본인이 쓴 글만 고칠 수 있습니다.' using errcode = '42501';
    end if;
    p_academy_id := v_post.academy_id;
  end if;

  v_role := public.my_academy_role(p_academy_id);
  if v_role is null then
    raise exception '이 학원의 승인된 회원만 글을 쓸 수 있습니다.' using errcode = '42501';
  end if;
  if p_category not in ('notice', 'general') then
    raise exception '글 종류를 골라 주세요.' using errcode = '22023';
  end if;
  if p_category = 'notice' and v_role not in ('director', 'teacher') then
    raise exception '공지는 원장·강사만 쓸 수 있습니다.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception '제목을 입력해 주세요.' using errcode = '22023';
  end if;
  if p_category = 'notice' and
     (coalesce(cardinality(p_audience), 0) = 0 or not (p_audience <@ array['teacher', 'parent', 'student'])) then
    raise exception '볼 대상을 골라 주세요.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.academy_posts (academy_id, category, title, content, is_pinned, audience, author_id)
    values (
      p_academy_id, p_category, btrim(p_title), coalesce(p_content, ''),
      p_category = 'notice' and coalesce(p_pinned, false),
      case when p_category = 'notice' then p_audience else '{teacher,parent,student}' end,
      auth.uid()
    )
    returning id into v_id;
    return v_id;
  end if;

  update public.academy_posts
  set category = p_category,
      title = btrim(p_title),
      content = coalesce(p_content, ''),
      is_pinned = p_category = 'notice' and coalesce(p_pinned, false),
      audience = case when p_category = 'notice' then p_audience else '{teacher,parent,student}' end
  where id = p_id;
  return p_id;
end;
$$;

revoke execute on function public.save_academy_post(bigint, bigint, text, text, text, boolean, text[]) from public, anon;
grant execute on function public.save_academy_post(bigint, bigint, text, text, text, boolean, text[]) to authenticated;

-- 글·댓글 작성자 이름과 역할 (그 학원 글을 볼 수 있는 회원만). 탈퇴한 작성자는 나오지 않는다.
create function public.academy_board_authors(p_academy_id bigint)
returns table (user_id uuid, name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, m.role
  from public.profiles p
  left join public.academy_members m on m.user_id = p.id and m.academy_id = p_academy_id
  where public.my_academy_role(p_academy_id) is not null
    and p.id in (
      select author_id from public.academy_posts where academy_id = p_academy_id
      union
      select c.author_id from public.academy_post_comments c
      join public.academy_posts ap on ap.id = c.post_id
      where ap.academy_id = p_academy_id
    )
$$;

revoke execute on function public.academy_board_authors(bigint) from public, anon;
grant execute on function public.academy_board_authors(bigint) to authenticated;

revoke execute on function
  public.my_academy_role(bigint),
  public.can_view_academy_post(bigint, text, text[]),
  public.post_academy(bigint)
from public, anon;

grant execute on function
  public.my_academy_role(bigint),
  public.can_view_academy_post(bigint, text, text[]),
  public.post_academy(bigint)
to authenticated;

-- ── 알림 ──

-- 새 공지: 볼 수 있는 소속 회원에게 (쓴 사람 제외)
create function public.academy_post_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy_name text;
  v_recipients uuid[];
begin
  if new.category <> 'notice' then
    return null;
  end if;
  select name into v_academy_name from public.academies where id = new.academy_id;
  select array_agg(user_id) into v_recipients
  from public.academy_members
  where academy_id = new.academy_id and status = 'approved'
    and (role = 'director' or role = any (new.audience))
    and user_id is distinct from new.author_id;

  perform public.notify_users(
    coalesce(v_recipients, '{}'), new.academy_id, 'academy_post',
    format('[%s 공지] %s', v_academy_name, new.title), left(nullif(new.content, ''), 200),
    format('/academy-posts/%s', new.id)
  );
  return null;
end;
$$;

create trigger academy_post_notify after insert on public.academy_posts
for each row execute function public.academy_post_notify();

-- 새 댓글: 글쓴이에게 (본인 댓글 제외)
create function public.post_comment_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post record;
  v_name text;
begin
  select id, academy_id, title, author_id into v_post from public.academy_posts where id = new.post_id;
  if v_post.author_id is null or v_post.author_id is not distinct from new.author_id then
    return null;
  end if;
  select name into v_name from public.profiles where id = new.author_id;
  perform public.notify_users(
    array[v_post.author_id], v_post.academy_id, 'post_comment',
    format('%s님이 "%s"에 댓글을 남겼어요', coalesce(v_name, '회원'), v_post.title), left(new.content, 200),
    format('/academy-posts/%s', v_post.id)
  );
  return null;
end;
$$;

create trigger post_comment_notify after insert on public.academy_post_comments
for each row execute function public.post_comment_notify();

revoke execute on function public.academy_post_notify(), public.post_comment_notify() from public, anon, authenticated;
