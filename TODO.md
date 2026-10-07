# 나중에 할 일

## 솔라피 연동 (휴대폰 문자 인증 실제 발송)

지금은 `SMS_PROVIDER=log` (문자를 보내지 않고 Edge Function 로그에만 인증번호를 남김), 인증 필수는 꺼짐.

1. [solapi.com](https://solapi.com) 가입, 잔액 충전 (SMS 1건 약 20원)
2. 발신번호 등록 (본인 휴대폰 번호 가능, 본인 인증 필요)
3. API Key 발급 (콘솔 → 개발/연동 → API Key 관리)
4. Supabase → Edge Functions → Secrets 설정 (API Secret 은 채팅·코드에 붙여 넣지 않기)
   - `SMS_PROVIDER` = `solapi`
   - `SOLAPI_API_KEY`
   - `SOLAPI_API_SECRET`
   - `SOLAPI_SENDER` = 등록한 발신번호 (숫자만)
   - (선택) `SMS_DAILY_LIMIT` = 하루 전체 발송 상한 (기본 300)
5. 본인 번호로 실제 문자 수신 테스트 (설정 → 휴대폰 인증하기)
   - 실패하면 Edge Functions → phone-verify → Logs 에서 `solapi error` 확인
6. 공지사항 올리기 — 인증 필수를 켜기 **7일 전** (개인정보 처리방침 변경 공지)
   - 예: "○월 ○일부터 휴대폰 인증이 필요합니다. 설정 → 휴대폰 인증하기에서 인증해 주세요.
     인증하지 않은 학부모·학생은 자녀 정보와 출석 알림이 연결되지 않습니다."
7. 공지한 날에 인증 필수 켜기 (SQL Editor)
   ```sql
   update public.app_settings set value = 'true' where key = 'phone_verification_required';
   ```
   끄기: `'true'` → `'false'`

참고: 인증하지 않은 예전 계정이 다른 사람의 번호를 쓰고 있으면 진짜 주인이 그 번호로 가입할 수 없음 → 운영자가 SQL 로 정리.
