// 웹 푸시 발송
// 알림(notifications)이 새로 생기면 Database Webhook 이 이 함수를 부른다 (README "웹 푸시").
// 받은 알림의 주인이 저장해 둔 모든 기기 구독(push_subscriptions)으로 같은 제목·내용을 푸시하고,
// 브라우저가 "없는 구독"(404·410)이라고 답한 구독은 지운다.
//
// 사용자가 직접 부르는 함수가 아니다: x-push-secret 헤더가 PUSH_WEBHOOK_SECRET 과 같아야 한다.
//
// 환경 변수 (Edge Functions → Secrets)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  `npx web-push generate-vapid-keys` 로 만든 키 쌍
//   VAPID_SUBJECT                        연락처 (mailto:운영자메일 또는 https://사이트주소)
//   PUSH_WEBHOOK_SECRET                  Database Webhook 헤더와 맞출 비밀값
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type NotificationRecord = {
  id: number
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: NotificationRecord | null
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!secret || !timingSafeEqual(req.headers.get('x-push-secret') ?? '', secret)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const payload = (await req.json()) as WebhookPayload
  const n = payload.record
  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !n?.user_id) {
    return json({ ok: true, sent: 0, skipped: 'not a new notification' })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', n.user_id)
  if (error) return json({ error: error.message }, 500)
  if (!subs?.length) return json({ ok: true, sent: 0 })

  const message = JSON.stringify({
    title: n.title,
    body: n.body ?? '',
    link: n.link ?? '/notices',
    tag: `notification-${n.id}`,
  })

  const gone: number[] = []
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, {
          TTL: 60 * 60 * 24,
        })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(s.id)
        else console.error('push failed', status, (e as Error).message)
      }
    }),
  )
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone)

  return json({ ok: true, sent, removed: gone.length })
})
