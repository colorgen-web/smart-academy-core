import { createClient } from '@supabase/supabase-js'

import { verifyRuntime } from '@/verify/mode'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * 검증 모드(운영자)일 때는 데이터 요청(REST·RPC·Edge Function)을 브라우저 안 검증 DB 로 보낸다.
 * 로그인(auth) 요청은 그대로 실제 서버로 간다.
 */
async function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { active, persona } = verifyRuntime()
  if (active) {
    const req = new Request(input, init)
    const path = new URL(req.url).pathname
    if (path.startsWith('/rest/v1/') || path.startsWith('/functions/v1/')) {
      const { handleLocal } = await import('@/verify/localApi')
      return handleLocal(req, persona)
    }
  }
  return fetch(input, init)
}

/** .env 가 비어 있으면 null — 화면은 뜨고 로그인 시 설정 안내를 보여준다. */
export const supabase = url && key ? createClient(url, key, { global: { fetch: appFetch } }) : null
