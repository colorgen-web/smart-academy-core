import { useEffect, useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { TABS, type TabKey } from '@/components/layout/tabs'
import { useAuth } from '@/hooks/useAuth'
import '@/hooks/useTheme' // 테마 적용 + OS 다크모드 변경 구독 (모듈 로드 시 1회)
import { completeNaverSignIn, NAVER_CALLBACK_PATH } from '@/lib/auth'
import { LoginPage } from '@/pages/LoginPage'
import { HomeTab } from '@/pages/tabs/HomeTab'
import { AttendanceTab, ClassesTab, LockedTab, NoticesTab } from '@/pages/tabs/PlaceholderTabs'
import { SettingsTab } from '@/pages/tabs/SettingsTab'

function isNaverCallback() {
  return window.location.pathname === NAVER_CALLBACK_PATH
}

function App() {
  const { session, loading } = useAuth()
  const [guest, setGuest] = useState(false)
  const [tab, setTab] = useState<TabKey>('home')
  const [naverPending, setNaverPending] = useState(isNaverCallback)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!isNaverCallback()) return
    completeNaverSignIn()
      .catch((e) => setAuthError(e instanceof Error ? e.message : '네이버 로그인에 실패했어요.'))
      .finally(() => {
        window.history.replaceState(null, '', '/')
        setNaverPending(false)
      })
  }, [])

  if (loading || naverPending) {
    return (
      <main className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        로그인 확인 중…
      </main>
    )
  }

  const user = session?.user ?? null
  if (!user && !guest) {
    return (
      <LoginPage
        onGuest={() => {
          setTab('home')
          setGuest(true)
        }}
        error={authError}
      />
    )
  }

  const isGuest = !user
  const goLogin = () => setGuest(false)
  const current = TABS.find((t) => t.key === tab)!

  let content
  if (isGuest && !current.guest) {
    content = <LockedTab label={current.label} onLogin={goLogin} />
  } else {
    switch (tab) {
      case 'home':
        content = <HomeTab user={user} onLogin={goLogin} />
        break
      case 'attendance':
        content = <AttendanceTab />
        break
      case 'classes':
        content = <ClassesTab />
        break
      case 'notices':
        content = <NoticesTab />
        break
      case 'settings':
        content = <SettingsTab user={user} onLogin={goLogin} />
        break
    }
  }

  return (
    <AppShell active={tab} onTabChange={setTab} isGuest={isGuest}>
      {content}
    </AppShell>
  )
}

export default App
