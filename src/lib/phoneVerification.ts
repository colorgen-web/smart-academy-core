import { supabase } from '@/lib/supabase'

/** 문자 인증 처리 결과. 실패 사유는 사용자에게 그대로 보여줄 수 있는 문장이다. */
export type PhoneVerifyResult =
  | { ok: true; expiresIn?: number; resendAfter?: number }
  | { ok: false; error: string; retryAfter?: number; expired?: boolean }

const FALLBACK_ERROR = '인증 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'

async function invoke(body: Record<string, string>): Promise<PhoneVerifyResult> {
  if (!supabase) return { ok: false, error: 'Supabase 설정이 없어요.' }
  const { data, error } = await supabase.functions.invoke<PhoneVerifyResult>('phone-verify', { body })
  if (error) {
    // 401·500 같은 응답도 { error } 문장을 담고 있다
    const context = (error as { context?: Response }).context
    const message = await context
      ?.json()
      .then((b: { error?: string }) => b.error)
      .catch(() => undefined)
    return { ok: false, error: message ?? FALLBACK_ERROR }
  }
  return data ?? { ok: false, error: FALLBACK_ERROR }
}

/** 인증번호 문자 보내기 */
export function sendPhoneCode(phone: string) {
  return invoke({ action: 'send', phone })
}

/** 인증번호 확인. 성공하면 30분 안에 이 번호로 회원 정보를 저장해야 인증된 번호가 된다. */
export function verifyPhoneCode(phone: string, code: string) {
  return invoke({ action: 'verify', phone, code })
}

let requiredCache: Promise<boolean> | null = null

/**
 * 휴대폰 인증이 필수인가 (운영자가 app_settings 로 켜고 끈다).
 * 확인하지 못하면 (DB 준비 전 등) 끈 것으로 본다.
 */
export function phoneVerificationRequired(): Promise<boolean> {
  if (!supabase) return Promise.resolve(false)
  requiredCache ??= Promise.resolve(supabase.rpc('phone_verification_required')).then(
    ({ data, error }) => {
      if (error) requiredCache = null
      return !error && data === true
    },
    () => {
      requiredCache = null
      return false
    },
  )
  return requiredCache
}
