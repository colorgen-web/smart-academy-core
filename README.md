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

## 학원과 소속

한 사람이 여러 학원에 원장·강사·학부모·학생으로 소속될 수 있습니다.

1. **학원 등록**: 원장 회원이 홈 > 내 학원 > 학원 등록 → 운영자가 설정 > 운영자 메뉴 > 학원 승인 관리에서 승인
2. **학원 가입**: 승인된 학원의 6자리 코드(학원 상세에서 원장이 확인)로 홈 > 코드로 가입 → 그 학원 원장이 학원 상세에서 승인

- 마이그레이션: `supabase/migrations/20261007000000_academies.sql` (profiles 다음에 실행)
- 모든 쓰기는 DB 함수(`register_academy`, `review_academy`, `request_academy_join`, `decide_academy_member`, `regenerate_join_code`)로만 하며, 함수 안에서 운영자/원장 권한을 다시 확인합니다.
- 회원가입의 회원 유형 "원장"은 학원 등록 자격일 뿐이고, 원장 권한은 운영자가 승인한 학원에만 생깁니다.

## 반 · 수업 · 출석

- **학생 명단** (`학원 상세 > 학생 명단`): 원장이 학생을 등록합니다. 계정이 없는 어린 학생도 등록할 수 있습니다.
  - 학부모 연락처(최대 2개)를 넣으면, 그 번호로 가입하고 이 학원에 **학부모로 승인된** 회원이 자녀의 반·시간표·출석을 봅니다.
  - 학생 연락처를 넣으면, 그 번호로 가입한 학생 회원이 본인 것을 봅니다.
- **반** (`수업 탭 > 새 반`): 이름·과목·강의실·담당 강사·시간표(요일별 시간 다르게 가능)·수강생.
- **수업 탭**: 요일별 수업(오늘 기본) + 학원별 반 목록. 가족은 자녀가 듣는 수업만 보입니다.
- **출석** (`반 > 출석 체크`): 출석/지각/결석/사유. 누르면 바로 저장, 다시 누르면 취소. 지난 날짜도 체크 가능(미래 불가).
- **출석 탭**: 원장·강사는 오늘 수업별 체크 현황, 가족은 자녀별 최근 30일 기록.
- 마이그레이션: `supabase/migrations/20261008000000_classes_attendance.sql` (academies 다음에 실행)
- 반 저장(`save_class`)과 출석 기록(`set_attendance`)은 DB 함수로만 하며 원장/강사 권한을 다시 확인합니다.

## 알림

알림은 DB 트리거·함수만 만들 수 있습니다 (사용자가 직접 만들 수 없음).

| 알림 | 받는 사람 | 언제 |
|---|---|---|
| 출석 | 연결된 학부모·학생 본인 | **오늘** 출석이 체크·변경될 때 (지난 날짜 수정은 알리지 않음) |
| 새 가입 신청 | 그 학원 원장 | 코드로 가입 신청 |
| 가입 승인·거절 | 신청자 | 원장이 처리 |
| 학원 등록 신청 | 운영자 | 원장이 학원 등록 |
| 학원 승인·거절 | 등록한 원장 | 운영자가 처리 |
| 학원 알림 | 원장이 고른 역할의 소속 회원 | 원장이 직접 보냄 (학원당 하루 20번) |

- 알림 탭: 최신순 20개씩, 누르면 읽음 처리 후 관련 화면으로 이동, 모두 읽음, 삭제
- 하단 알림 탭 배지와 홈 "새 알림"은 화면 이동·앱 복귀·1분마다 갱신 (실시간 푸시는 아직 없음)
- 마이그레이션: `supabase/migrations/20261009000000_notifications.sql` (classes_attendance 다음에 실행)

## 회원 탈퇴

설정 > 맨 아래 **회원 탈퇴**. DB 함수 `delete_my_account()` 가 로그인 계정(auth.users)을 지우면 회원 정보·학원 소속·알림·네이버 연결이 함께 지워집니다.

- 남는 것: 학원의 학생 명단·출석 기록(학원 소유), 작성한 공지·출석 체크(작성자만 비움)
- 막는 경우: 운영 중인(승인된) 학원의 원장, 운영자 권한 계정 — 화면에 이유를 보여 줌
- 승인 대기·거절된 학원은 함께 정리, 소속 학원 원장에게 "회원 탈퇴" 알림
- 카카오 쪽 앱 연결은 남을 수 있음 (사용자가 카카오 계정 설정에서 끊을 수 있음)
- 마이그레이션: `supabase/migrations/20261010000000_account_deletion.sql` (notifications 다음에 실행)

## 휴대폰 문자 인증

인증번호 발송·확인은 Edge Function `phone-verify`, 인증 여부 확인은 DB 트리거가 한다.

1. SQL Editor 에서 `supabase/migrations/20261011000000_phone_verification.sql` 실행 (**앱 배포 전에** 먼저)
2. Edge Function `phone-verify` 배포 (`supabase/functions/phone-verify/index.ts`, **Verify JWT 끔** — 함수가 직접 로그인 토큰을 확인한다)
3. Edge Functions → Secrets
   - `SMS_PROVIDER`: `log`(문자를 보내지 않고 함수 로그에 인증번호만 남김, 테스트용) 또는 `solapi`
   - `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER`(솔라피에 등록한 발신번호)
   - `SMS_DAILY_LIMIT`(선택, 하루 전체 발송 상한, 기본 300), `PHONE_CODE_PEPPER`(선택)
4. 인증 필수 켜기 (기본은 꺼짐 — 꺼져 있으면 인증 화면이 나오지 않고 예전처럼 동작)
   ```sql
   update public.app_settings set value = 'true' where key = 'phone_verification_required';
   ```

켜면

- 회원가입과 휴대폰 번호 변경에 문자 인증이 필요하다 (인증 후 30분 안에 저장).
- 학부모·학생의 자녀(본인) 연결과 출석 알림은 인증된 번호로만 된다. 기존 회원은 홈 배너·설정에서 지금 번호를 인증할 수 있다.
- 제한: 인증번호 3분 유효, 5회 틀리면 다시 받기, 재요청 60초 간격, 한 계정·한 번호당 하루 5회. 인증 기록은 30일 뒤 지운다.

## 수업 이해도

학생 계정이 수업 후 이해도(1~5단계)와 코멘트를 남긴다. 원장·강사와 학부모는 보기만 한다.

- 남기는 곳: 수업 탭 시간표의 "수업 이해도 남기기" (오늘 수업은 시작 시간 이후), 반 화면
- 남길 수 있는 수업: 본인이 듣는 운영 중인 반, 시간표 요일의 최근 7일, 결석·사유 결석이 아닌 날 — 그 안에서는 고치기·지우기 가능
- 학부모: 처음 남길 때 알림, 시간표·반 화면에서 자녀의 단계·추이·코멘트
- 원장·강사: 반 화면에서 수강생별 최근 8주 추이·평균과 최근 코멘트
- 학생 계정 연결: 학생 명단의 **학생 연락처**가 학생 회원의 휴대폰 번호와 같아야 한다
- 마이그레이션: `supabase/migrations/20261012000000_lesson_feedback.sql`

## 이용약관 · 개인정보 처리방침

- `/terms`, `/privacy` — 로그인 없이 볼 수 있음 (카카오·네이버 앱 검수 시 이 주소를 등록)
- 운영자 이름·연락처·시행일은 `src/legal/operator.ts` 한 곳에서 관리
- 로그인 화면 하단, 회원가입 동의 항목(전문 보기, 새 탭), 설정 하단에서 연결
- 내용이 바뀌면 시행일을 고치고, 시행 7일 전(불리한 변경은 30일 전) 공지사항으로 알릴 것
