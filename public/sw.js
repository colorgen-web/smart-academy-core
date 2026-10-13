// 서비스 워커: 웹 푸시 알림만 처리한다 (화면·데이터 캐시는 하지 않음 — 배포하면 바로 새 버전이 뜬다)
// 푸시 내용은 Edge Function send-push 가 보낸다: { title, body, link, tag }

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data ? event.data.text() : '' }
  }
  // 푸시를 받으면 반드시 알림을 띄워야 한다 (안 띄우면 브라우저가 구독을 끊을 수 있음)
  event.waitUntil(
    self.registration.showNotification(data.title || 'Smart Academy', {
      body: data.body || undefined,
      icon: '/app-icon-192.png',
      badge: '/app-icon-192.png',
      tag: data.tag || undefined,
      data: { link: data.link || '/notices' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.link || '/notices', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        if ('navigate' in open) await open.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
