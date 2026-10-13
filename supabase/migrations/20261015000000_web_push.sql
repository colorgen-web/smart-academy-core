-- 웹 푸시 알림
-- 기기(브라우저)마다 푸시 구독을 저장한다. 알림(notifications)이 생기면 Database Webhook 이
-- Edge Function send-push 를 불러 그 사람의 모든 기기로 같은 내용을 푸시한다 (README "웹 푸시").
-- 구독 저장은 save_push_subscription() 으로만, 보기·지우기는 본인 것만.
-- (academy_deletion 다음에 실행)

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "푸시 구독: 본인 것만 본다" on public.push_subscriptions for select to authenticated
using (user_id = auth.uid());
create policy "푸시 구독: 본인 것만 지운다" on public.push_subscriptions for delete to authenticated
using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;

-- 이 기기의 구독을 내 것으로 저장한다.
-- 같은 브라우저에서 다른 계정이 쓰던 구독(endpoint 가 같음)은 지금 로그인한 사람 것으로 옮긴다.
create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception '푸시 구독 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 500))
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      created_at = now();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
