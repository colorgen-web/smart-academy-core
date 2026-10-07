import { useAsync } from '@/hooks/useAsync'
import { phoneVerificationRequired } from '@/lib/phoneVerification'

/** 휴대폰 인증 필수 여부. 확인 중이면 undefined */
export function usePhoneVerificationRequired() {
  return useAsync(phoneVerificationRequired, []).data
}
