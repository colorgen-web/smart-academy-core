-- 회원가입 정보 + 네이버 계정 연결
-- 네이버와 카카오는 서로 다른 계정이다 (이메일이 같아도 합치지 않는다).
--   카카오: Supabase 기본 OAuth (auth.identities 에 카카오 ID)
--   네이버: naver_accounts 에서 네이버 ID → 계정(uuid) 을 찾는다. Edge Function(naver-auth)만 접근.

-- 1) 네이버 ID ↔ 계정 연결 (서비스 키 전용: RLS 켜고 정책 없음)
create table public.naver_accounts (
  naver_id text primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.naver_accounts enable row level security;
revoke all on public.naver_accounts from anon, authenticated;

-- 2) 회원 정보 (로그인 후 회원가입 화면에서 입력)
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  -- 숫자만 저장 (01012345678)
  phone text not null unique check (phone ~ '^01[016789][0-9]{7,8}$'),
  -- 본인이 고른 회원 유형. 권한(원장·강사 기능)은 이 값이 아니라 학원 승인으로 따로 준다.
  member_type text not null check (member_type in ('parent', 'student', 'teacher', 'director')),
  -- 아래 값들은 트리거가 채운다 (사용자가 직접 넣을 수 없음)
  provider text not null check (provider in ('kakao', 'naver')),
  email text,
  over_14_confirmed boolean not null check (over_14_confirmed),
  terms_agreed_at timestamptz not null default now(),
  privacy_agreed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '회원 정보. 네이버/카카오 계정마다 1개';

-- 가입 방법·이메일·동의 시각은 auth 정보와 서버 시간으로 채운다
create function public.profiles_fill_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user record;
begin
  -- 본인 것만 (RLS 보다 트리거가 먼저 실행되므로 여기서도 막아 다른 계정 존재 여부가 드러나지 않게 한다)
  if new.id is distinct from auth.uid() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select email, raw_app_meta_data into auth_user from auth.users where id = new.id;
  if not found then
    raise exception 'auth user % not found', new.id;
  end if;

  if auth_user.raw_app_meta_data ? 'naver_id' then
    new.provider := 'naver';
    new.email := auth_user.raw_app_meta_data ->> 'naver_email';
  else
    new.provider := auth_user.raw_app_meta_data ->> 'provider';
    new.email := auth_user.email;
  end if;

  new.terms_agreed_at := now();
  new.privacy_agreed_at := now();
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_fill_from_auth
before insert on public.profiles
for each row execute function public.profiles_fill_from_auth();

-- touch_updated_at 은 announcements 마이그레이션에서 만든 함수
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

create policy "본인 회원 정보는 본인이 읽는다 (관리자는 전체)"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "본인 회원 정보만 만들 수 있다"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "본인 회원 정보만 고칠 수 있다"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- 사용자가 직접 쓸 수 있는 칸을 제한한다 (가입 방법·이메일·동의 시각은 못 바꿈)
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant insert (id, name, phone, member_type, over_14_confirmed) on public.profiles to authenticated;
grant update (name, phone, member_type) on public.profiles to authenticated;

-- 3) 휴대폰 중복 확인: 이미 가입된 번호면 그 계정의 가입 방법('kakao' | 'naver')을, 아니면 null
create function public.phone_signup_provider(p_phone text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select provider from public.profiles where phone = p_phone and id <> auth.uid() limit 1
$$;

revoke execute on function public.phone_signup_provider(text) from public, anon;
grant execute on function public.phone_signup_provider(text) to authenticated;
