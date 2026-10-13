import { supabase } from '@/lib/supabase'

/**
 * 웹 푸시 알림 (이 기기·브라우저 단위).
 * 켜면 서비스 워커(public/sw.js)를 등록하고 브라우저 푸시 구독을 DB(push_subscriptions)에 저장한다.
 * 알림이 생기면 Edge Function send-push 가 저장된 구독으로 푸시를 보낸다.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export type PushStatus =
  | 'unsupported' // 브라우저가 웹 푸시를 지원하지 않음
  | 'needs-install' // 아이폰·아이패드: 홈 화면에 추가한 앱에서만 된다 (iOS 16.4 이상)
  | 'unconfigured' // VITE_VAPID_PUBLIC_KEY 가 없음 (운영 설정 전)
  | 'denied' // 사용자가 알림을 차단함
  | 'off'
  | 'on'

/** VAPID 공개키(base64url) → pushManager.subscribe 가 받는 바이트 배열 */
export function urlBase64ToUint8Array(base64url: string) {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** 아이폰·아이패드 (iPadOS 데스크톱 모드 포함) */
export function isIos(userAgent: string, maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** 이미 등록된 서비스 워커의 구독 (없으면 null). 서비스 워커를 새로 등록하지는 않는다 */
async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration('/')
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function getPushStatus(): Promise<PushStatus> {
  if (isIos(navigator.userAgent, navigator.maxTouchPoints) && !isStandalone()) return 'needs-install'
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

/** 알림 허용을 묻고(버튼을 누를 때만 불러야 한다) 이 기기를 구독해 저장한다 */
export async function enablePush(): Promise<PushStatus> {
  if (!supabase) throw new Error('Supabase 설정이 없어요.')
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return getPushStatus()

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const { endpoint, keys } = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys?.p256dh,
    p_auth: keys?.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) {
    await sub.unsubscribe()
    throw error
  }
  return 'on'
}

/** 이 기기의 구독을 끊고 DB 에서도 지운다. 로그아웃할 때도 부른다 (다음 사람에게 앞 사람 알림이 가지 않게) */
export async function disablePush() {
  if (!pushSupported()) return
  const sub = await currentSubscription()
  if (!sub) return
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
