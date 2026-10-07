// 휴대폰 문자 인증
// POST { action: 'send', phone }          → 인증번호 문자 발송
// POST { action: 'verify', phone, code }  → 인증번호 확인, 맞으면 phone_verifications.verified_at 기록
// 확인된 번호는 30분 안에 profiles.phone 으로 저장하면 phone_verified_at 이 채워진다 (DB 트리거).
//
// 로그인한 사용자만 쓸 수 있다 (Authorization 헤더의 세션 토큰을 직접 확인).
// 업무상 실패(번호 오류, 횟수 초과 등)는 200 + { ok: false, error } 로 돌려준다.
//
// 환경 변수 (Edge Functions → Secrets)
//   SMS_PROVIDER        'solapi' | 'log' (기본 log: 문자를 보내지 않고 로그에만 남김 — 테스트용)
//   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER(등록한 발신번호, 숫자만)
//   SMS_DAILY_LIMIT     하루 전체 발송 상한 (기본 300)
//   PHONE_CODE_PEPPER   인증번호 해시용 비밀값 (없으면 service role key 사용)
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CODE_TTL_SECONDS = 180
const RESEND_SECONDS = 60
const MAX_ATTEMPTS = 5
const USER_DAILY_LIMIT = 5
const PHONE_DAILY_LIMIT = 5
const SERVICE_NAME = 'Smart Academy'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const fail = (error: string, extra: Record<string, unknown> = {}) => json({ ok: false, error, ...extra })

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
}

function codeHash(userId: string, phone: string, code: string) {
  const pepper = Deno.env.get('PHONE_CODE_PEPPER') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return hmac(pepper, `${userId}:${phone}:${code}`)
}

function randomCode() {
  // 000000 ~ 999999 균등 분포 (2^32 를 넘는 쪽은 버림)
  const buf = new Uint32Array(1)
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** 오늘 0시 (한국 시간) */
function startOfTodayKst() {
  const kst = new Date(Date.now() + 9 * 3600_000)
  kst.setUTCHours(0, 0, 0, 0)
  return new Date(kst.getTime() - 9 * 3600_000).toISOString()
}

async function sendSms(to: string, text: string) {
  const provider = Deno.env.get('SMS_PROVIDER') ?? 'log'
  if (provider === 'log') {
    console.log(`[SMS log mode] to=${to} text=${text}`)
    return
  }
  if (provider !== 'solapi') throw new Error(`알 수 없는 SMS_PROVIDER: ${provider}`)

  const apiKey = Deno.env.get('SOLAPI_API_KEY')
  const apiSecret = Deno.env.get('SOLAPI_API_SECRET')
  const from = Deno.env.get('SOLAPI_SENDER')?.replace(/\D/g, '')
  if (!apiKey || !apiSecret || !from) throw new Error('Solapi 설정(SOLAPI_API_KEY/SECRET/SENDER)이 없습니다.')

  const date = new Date().toISOString()
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const signature = await hmac(apiSecret, date + salt)
  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { to, from, text } }),
  })
  if (!res.ok) {
    console.error('solapi error', res.status, await res.text())
    throw new Error('문자 발송 실패')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } }
    const user = auth.user
    if (!user) return json({ error: '로그인이 필요합니다.' }, 401)

    const body = await req.json().catch(() => ({}))
    const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : ''
    if (!/^01[016789]\d{7,8}$/.test(phone)) return fail('휴대폰 번호를 확인해 주세요.')

    if (body.action === 'send') {
      // 이미 다른 계정이 쓰는 번호면 문자를 보내지 않는다
      const { data: taken, error: takenError } = await admin
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .neq('id', user.id)
        .limit(1)
      if (takenError) throw takenError
      if (taken.length) return fail('이미 다른 계정에서 사용 중인 번호예요.')

      const today = startOfTodayKst()
      const { data: recent, error: recentError } = await admin
        .from('phone_verifications')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', today)
        .order('created_at', { ascending: false })
      if (recentError) throw recentError

      if (recent.length) {
        const waited = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000
        if (waited < RESEND_SECONDS) {
          const retryAfter = Math.ceil(RESEND_SECONDS - waited)
          return fail(`${retryAfter}초 후에 다시 요청해 주세요.`, { retryAfter })
        }
      }
      if (recent.length >= USER_DAILY_LIMIT) return fail('오늘 인증 요청 횟수를 모두 사용했어요. 내일 다시 시도해 주세요.')

      const { count: phoneCount, error: phoneError } = await admin
        .from('phone_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('phone', phone)
        .gte('created_at', today)
      if (phoneError) throw phoneError
      if ((phoneCount ?? 0) >= PHONE_DAILY_LIMIT) return fail('이 번호로 오늘 인증 요청 횟수를 모두 사용했어요. 내일 다시 시도해 주세요.')

      const dailyLimit = Number(Deno.env.get('SMS_DAILY_LIMIT') ?? 300)
      const { count: totalCount, error: totalError } = await admin
        .from('phone_verifications')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)
      if (totalError) throw totalError
      if ((totalCount ?? 0) >= dailyLimit) {
        console.error('SMS daily limit reached', totalCount)
        return fail('지금은 인증 문자를 보낼 수 없어요. 잠시 후 다시 시도해 주세요.')
      }

      // 30일 지난 인증 기록 정리 (개인정보 처리방침 제3조)
      await admin
        .from('phone_verifications')
        .delete()
        .lt('created_at', new Date(Date.now() - 30 * 24 * 3600_000).toISOString())

      const code = randomCode()
      const { data: row, error: insertError } = await admin
        .from('phone_verifications')
        .insert({
          user_id: user.id,
          phone,
          code_hash: await codeHash(user.id, phone, code),
          expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      try {
        await sendSms(phone, `[${SERVICE_NAME}] 인증번호 [${code}] (3분 안에 입력해 주세요)`)
      } catch (e) {
        // 보내지 못한 요청은 횟수에서 빼 준다
        await admin.from('phone_verifications').delete().eq('id', row.id)
        throw e
      }
      return json({ ok: true, expiresIn: CODE_TTL_SECONDS, resendAfter: RESEND_SECONDS })
    }

    if (body.action === 'verify') {
      const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : ''
      if (code.length !== 6) return fail('인증번호 6자리를 입력해 주세요.')

      // 이 번호로 가장 최근에 받은 인증번호만 유효하다
      const { data: row, error } = await admin
        .from('phone_verifications')
        .select('id, code_hash, attempts, expires_at, verified_at')
        .eq('user_id', user.id)
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!row) return fail('인증번호를 먼저 요청해 주세요.')
      if (row.verified_at) return json({ ok: true })
      if (new Date(row.expires_at).getTime() < Date.now()) return fail('인증 시간이 지났어요. 인증번호를 다시 받아 주세요.', { expired: true })
      if (row.attempts >= MAX_ATTEMPTS) return fail('입력 횟수를 넘었어요. 인증번호를 다시 받아 주세요.', { expired: true })

      const matched = timingSafeEqual(row.code_hash, await codeHash(user.id, phone, code))
      const { error: updateError } = await admin
        .from('phone_verifications')
        .update(matched ? { verified_at: new Date().toISOString() } : { attempts: row.attempts + 1 })
        .eq('id', row.id)
      if (updateError) throw updateError

      if (!matched) {
        const left = MAX_ATTEMPTS - row.attempts - 1
        return left > 0
          ? fail(`인증번호가 맞지 않아요. (${left}번 남음)`)
          : fail('입력 횟수를 넘었어요. 인증번호를 다시 받아 주세요.', { expired: true })
      }
      return json({ ok: true })
    }

    return json({ error: 'action 은 send 또는 verify 여야 합니다.' }, 400)
  } catch (e) {
    console.error('phone-verify error', e)
    return json({ error: '인증 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }, 500)
  }
})
