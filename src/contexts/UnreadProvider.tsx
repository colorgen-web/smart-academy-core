import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'

import { UnreadContext } from '@/contexts/unreadContext'
import { fetchUnreadCount } from '@/lib/notifications'

const POLL_MS = 60_000

/** 읽지 않은 알림 수: 화면 이동·앱으로 돌아올 때·1분마다 다시 센다 */
export function UnreadProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [count, setCount] = useState(0)
  const { pathname } = useLocation()

  const refresh = useCallback(() => {
    if (!enabled) return
    fetchUnreadCount().then(setCount, () => {
      // 네트워크 오류는 다음 주기에 다시 시도
    })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const timer = window.setInterval(refresh, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, refresh, pathname])

  return <UnreadContext.Provider value={{ count: enabled ? count : 0, refresh }}>{children}</UnreadContext.Provider>
}
