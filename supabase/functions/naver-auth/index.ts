// 네이버 로그인 → Supabase 세션 발급
// 1) 네이버 code 로 access token 발급  2) 네이버 프로필(이메일) 조회
// 3) 같은 이메일의 Supabase 사용자를 만들거나 재사용  4) 매직링크 token_hash 를 돌려줌
//    → 클라이언트가 supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) 로 로그인
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type NaverProfile = {
  id: string
  email?: string
  name?: string
  nickname?: string
  profile_image?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { code, state } = await req.json()
    if (typeof code !== 'string' || typeof state !== 'string') {
      return json({ error: 'code 와 state 가 필요합니다.' }, 400)
    }

    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token')
    tokenUrl.search = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: Deno.env.get('NAVER_CLIENT_ID')!,
      client_secret: Deno.env.get('NAVER_CLIENT_SECRET')!,
      code,
      state,
    }).toString()
    const token = await (await fetch(tokenUrl)).json()
    if (!token.access_token) {
      console.error('naver token error', token)
      return json({ error: '네이버 인증에 실패했습니다.' }, 401)
    }

    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    const profile = await profileRes.json()
    const naver: NaverProfile | undefined = profile.response
    if (profile.resultcode !== '00' || !naver) {
      console.error('naver profile error', profile)
      return json({ error: '네이버 프로필을 가져오지 못했습니다.' }, 401)
    }
    if (!naver.email) {
      return json({ error: '네이버 이메일 제공 동의가 필요합니다.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { error: createError } = await admin.auth.admin.createUser({
      email: naver.email,
      email_confirm: true,
      user_metadata: {
        provider: 'naver',
        naver_id: naver.id,
        name: naver.name ?? naver.nickname,
        avatar_url: naver.profile_image,
      },
    })
    if (createError && createError.code !== 'email_exists' && createError.code !== 'user_already_exists') {
      throw createError
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: naver.email,
    })
    if (error) throw error

    return json({ token_hash: data.properties.hashed_token })
  } catch (error) {
    console.error(error)
    return json({ error: '네이버 로그인 처리 중 오류가 발생했습니다.' }, 500)
  }
})
