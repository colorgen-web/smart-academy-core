import { useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { completeNaverSignIn, NAVER_CALLBACK_PATH } from '@/lib/auth'
import { GuestHomePage } from '@/pages/GuestHomePage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'

function isNaverCallback() {
  return window.location.pathname === NAVER_CALLBACK_PATH
}

function App() {
  const { session, loading } = useAuth()
  const [guest, setGuest] = useState(false)
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

  if (session) return <HomePage user={session.user} />
  if (guest) return <GuestHomePage onLogin={() => setGuest(false)} />
  return <LoginPage onGuest={() => setGuest(true)} error={authError} />
}

export default App
