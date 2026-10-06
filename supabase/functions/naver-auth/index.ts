// 네이버 로그인 → Supabase 세션 발급
// 네이버와 카카오는 서로 다른 계정이다. 네이버 계정은 이메일이 아니라 "네이버 ID"로 찾는다.
// 1) 네이버 code 로 access token 발급  2) 네이버 프로필 조회
// 3) naver_accounts 에서 네이버 ID → 계정(uuid) 조회, 없으면 새 계정 생성
// 4) 매직링크 token_hash 를 돌려줌 → 클라이언트가 verifyOtp({ token_hash, type: 'magiclink' }) 로 로그인
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Supabase 는 이메일이 같은 계정을 자동으로 합치므로, 네이버 계정의 로그인용 주소는 실제 이메일과 겹치지 않는
// 내부 주소를 쓴다 (메일은 보내지 않음). 실제 이메일은 app_metadata.naver_email → profiles.email 로 간다.
// 네이버 ID 는 대소문자를 구분하지만 이메일은 구분하지 않으므로, ID 를 그대로 넣지 않고 SHA-256 해시(앞 40자리)를 쓴다.
async function internalEmail(naverId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(naverId))
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return `naver_${hex.slice(0, 40)}@users.smart-academy.invalid`
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
    if (profile.resultcode !== '00' || !naver?.id) {
      console.error('naver profile error', profile)
      return json({ error: '네이버 프로필을 가져오지 못했습니다.' }, 401)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const loginEmail = await internalEmail(naver.id)

    const findLinkedUser = async () => {
      const { data, error } = await admin
        .from('naver_accounts')
        .select('user_id')
        .eq('naver_id', naver.id)
        .maybeSingle()
      if (error) throw error
      return data?.user_id as string | undefined
    }

    if (!(await findLinkedUser())) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
        app_metadata: { naver_id: naver.id, naver_email: naver.email ?? null },
        user_metadata: {
          provider: 'naver',
          name: naver.name ?? naver.nickname,
          avatar_url: naver.profile_image,
        },
      })
      if (created?.user) {
        const { error: linkError } = await admin
          .from('naver_accounts')
          .insert({ naver_id: naver.id, user_id: created.user.id })
        // 23505: 동시에 들어온 다른 요청이 먼저 연결함 → 아래에서 그 계정으로 로그인
        if (linkError && linkError.code !== '23505') throw linkError
      } else if (createError?.code !== 'email_exists' && createError?.code !== 'user_already_exists') {
        throw createError
      }
      if (!(await findLinkedUser())) {
        // 계정은 있는데 연결 기록이 없는 경우(이전 요청이 중간에 실패) → 내부 주소로 찾아 연결
        const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: loginEmail,
        })
        if (linkErr) throw linkErr
        const { error: insertErr } = await admin
          .from('naver_accounts')
          .insert({ naver_id: naver.id, user_id: link.user.id })
        if (insertErr && insertErr.code !== '23505') throw insertErr
      }
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
    })
    if (error) throw error

    return json({ token_hash: data.properties.hashed_token })
  } catch (error) {
    console.error(error)
    return json({ error: '네이버 로그인 처리 중 오류가 발생했습니다.' }, 500)
  }
})
