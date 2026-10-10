import { supabase } from '@/lib/supabase'
import { stopVerifyMode, verifyRuntime } from '@/verify/mode'

export type SocialProvider = 'naver' | 'kakao'

export const NAVER_CALLBACK_PATH = '/auth/naver/callback'
const NAVER_STATE_KEY = 'naver_oauth_state'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  }
  return supabase
}

/** 카카오: Supabase 기본 제공 OAuth */
export async function signInWithKakao() {
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

/** 네이버: Supabase 기본 제공이 아니라 네이버 인증 페이지로 직접 보낸다. 콜백은 completeNaverSignIn 이 처리 */
export function signInWithNaver() {
  requireSupabase()
  const clientId = import.meta.env.VITE_NAVER_CLIENT_ID
  if (!clientId) {
    throw new Error('네이버 Client ID 설정이 없어요. .env 파일을 확인해 주세요.')
  }

  const state = crypto.randomUUID()
  sessionStorage.setItem(NAVER_STATE_KEY, state)

  const url = new URL('https://nid.naver.com/oauth2.0/authorize')
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: window.location.origin + NAVER_CALLBACK_PATH,
    state,
  }).toString()
  window.location.assign(url)
}

export function signIn(provider: SocialProvider) {
  return provider === 'kakao' ? signInWithKakao() : signInWithNaver()
}

let naverCallback: Promise<void> | null = null

/**
 * 네이버 콜백: code 를 Edge Function(naver-auth)에 넘겨 Supabase 로그인용 토큰을 받고 세션을 만든다.
 * StrictMode 에서 두 번 호출돼도 code 는 한 번만 쓰도록 promise 를 재사용한다.
 */
export function completeNaverSignIn() {
  naverCallback ??= (async () => {
    const client = requireSupabase()
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const savedState = sessionStorage.getItem(NAVER_STATE_KEY)
    sessionStorage.removeItem(NAVER_STATE_KEY)

    if (params.get('error')) throw new Error('네이버 로그인이 취소되었어요.')
    if (!code || !state || state !== savedState) {
      throw new Error('잘못된 로그인 요청이에요. 다시 시도해 주세요.')
    }

    const { data, error } = await client.functions.invoke<{ token_hash: string }>('naver-auth', {
      body: { code, state },
    })
    if (error || !data?.token_hash) {
      throw new Error('네이버 로그인 처리에 실패했어요.')
    }

    const { error: otpError } = await client.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    })
    if (otpError) throw otpError
  })()
  return naverCallback
}

export async function signOut() {
  // 검증 모드에서는 실제 로그아웃 대신 검증 모드를 끝낸다 (운영자 계정으로 돌아감)
  if (verifyRuntime().active) {
    stopVerifyMode()
    return
  }
  await supabase?.auth.signOut()
}

/** 관리자 여부 (화면 표시용). 실제 권한은 DB 의 RLS(is_admin)가 검사한다. */
export function isAdmin(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return user?.app_metadata?.role === 'admin'
}
