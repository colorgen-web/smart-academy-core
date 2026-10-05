# smart-academy-core

Smart Academy 코어 프로젝트 (React + Vite + TypeScript + Tailwind + shadcn/ui)

디자인 규칙(색상 토큰, 라이트/다크, 레이아웃)은 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) 참고.

## 시작하기

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # 린트
```

## 로그인 (Supabase)

카카오는 Supabase 기본 제공 OAuth를 쓰고, 네이버는 Supabase가 기본 지원하지 않아
Edge Function(`supabase/functions/naver-auth`)이 네이버 인증 후 Supabase 세션을 발급합니다.

```
[네이버 버튼] → nid.naver.com 인증 → /auth/naver/callback?code=…
  → Edge Function naver-auth (토큰 교환·프로필 조회·사용자 생성) → token_hash
  → supabase.auth.verifyOtp() → 로그인 완료
```

### 1. 환경 변수

`.env.example`을 `.env`로 복사하고 값을 채웁니다.

| 변수 | 위치 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 대시보드 > Project Settings > API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 같은 화면의 publishable(또는 anon) key |
| `VITE_NAVER_CLIENT_ID` | 네이버 개발자센터 > 내 애플리케이션 > Client ID |

### 2. 카카오 설정

1. [카카오 개발자](https://developers.kakao.com) > 내 애플리케이션 > 앱 추가
2. 카카오 로그인 활성화, Redirect URI에 `https://<project-ref>.supabase.co/auth/v1/callback` 등록
3. 동의항목에서 닉네임·프로필 사진·카카오계정(이메일) 설정 (이메일은 비즈 앱 전환 필요)
4. Supabase 대시보드 > Authentication > Sign In / Providers > Kakao 에 REST API 키(Client ID)와 Client Secret 입력

### 3. 네이버 설정

1. [네이버 개발자센터](https://developers.naver.com) > 애플리케이션 등록 > 사용 API: 네이버 로그인
2. 제공 정보: 이메일 주소(필수), 이름·별명·프로필 사진
3. Callback URL 등록: `http://localhost:5173/auth/naver/callback`, 배포 주소의 `/auth/naver/callback`
4. Edge Function 시크릿 등록 후 배포 (Supabase CLI)

```bash
supabase secrets set NAVER_CLIENT_ID=… NAVER_CLIENT_SECRET=…
supabase functions deploy naver-auth --no-verify-jwt
```

### 4. 리디렉션 URL

Supabase 대시보드 > Authentication > URL Configuration 의 Redirect URLs에
`http://localhost:5173`과 배포 주소를 추가합니다.

> 배포 시 `/auth/naver/callback` 경로가 `index.html`로 가도록 SPA rewrite가 필요합니다 (Vercel은 `vercel.json`에 포함).

### 참고

- 네이버와 카카오는 **서로 다른 계정**입니다 (이메일이 같아도 합치지 않음). 네이버 계정은 `naver_accounts` 테이블에서 네이버 ID로 찾습니다.
- 처음 로그인하면 회원가입 화면(이름·휴대폰·회원 유형·약관 동의)이 나오고, 정보는 `profiles` 에 저장됩니다. 휴대폰 번호는 계정 간 중복될 수 없습니다.
- 마이그레이션: `supabase/migrations/20261006000000_profiles.sql` 을 SQL Editor 에서 실행 (공지사항 마이그레이션 다음에).
- 게스트 둘러보기는 로그인 없이 화면만 보여 줍니다 (세션 없음).

## 공지사항

- 메인 화면: 최신 5개 (고정 공지 먼저) + 전체보기
- 전체 목록 `/announcements?page=N`: 10개씩, 페이지 번호는 5개 단위로 묶어서 표시
- 상세 `/announcements/:id`, 관리자 글쓰기 `/announcements/new`

### 1. 테이블 만들기
Supabase 대시보드 > **SQL Editor** 에서 `supabase/migrations/20261005000000_announcements.sql` 내용을 실행합니다.
(누구나 읽기 가능, 작성·삭제는 관리자만 — RLS 로 DB 가 직접 막습니다)

### 2. 관리자 지정
SQL Editor 에서 관리자로 쓸 계정의 이메일로 실행합니다. 한 번 로그아웃 후 다시 로그인해야 적용됩니다.

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
where email = '관리자@이메일.com';
```

관리자로 로그인하면 공지사항 목록에 **글쓰기**, 상세 화면에 **삭제** 버튼이 보입니다.
