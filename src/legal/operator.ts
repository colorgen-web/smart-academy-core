/**
 * 이용약관·개인정보 처리방침에 들어가는 운영자 정보.
 * 내용이 바뀌면 여기만 고치고, 문서 내용이 바뀌는 경우 LEGAL_EFFECTIVE_DATE 와 개정 이력도 함께 고친다.
 */
export const SERVICE_NAME = 'Smart Academy'

/** 운영 주체: 개인 (사업자등록 없음) */
export const OPERATOR = {
  /** 처리방침의 '개인정보 보호책임자' 성명. 실명을 넣는 것을 권장 (개인정보 보호법 제31조) */
  name: 'Smart Academy 운영자',
  type: '개인',
  email: 'colorogen@naver.com',
}

/** 시행일 */
export const LEGAL_EFFECTIVE_DATE = '2026년 10월 7일'
