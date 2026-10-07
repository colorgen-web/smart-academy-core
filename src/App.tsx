import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { UnreadProvider } from '@/contexts/UnreadProvider'
import { Button } from '@/components/ui/button'
import { TABS } from '@/components/layout/tabs'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import '@/hooks/useTheme' // 테마 적용 + OS 다크모드 변경 구독 (모듈 로드 시 1회)
import { completeNaverSignIn, isAdmin as checkAdmin, NAVER_CALLBACK_PATH } from '@/lib/auth'
import { AcademyDetailPage } from '@/pages/academies/AcademyDetailPage'
import { AcademyJoinPage } from '@/pages/academies/AcademyJoinPage'
import { AcademyMessagePage } from '@/pages/academies/AcademyMessagePage'
import { AcademyRegisterPage } from '@/pages/academies/AcademyRegisterPage'
import { StudentsPage } from '@/pages/academies/StudentsPage'
import { AttendanceCheckPage } from '@/pages/classes/AttendanceCheckPage'
import { ClassDetailPage } from '@/pages/classes/ClassDetailPage'
import { ClassFormPage } from '@/pages/classes/ClassFormPage'
import { AdminAcademiesPage } from '@/pages/admin/AdminAcademiesPage'
import { AnnouncementDetailPage } from '@/pages/announcements/AnnouncementDetailPage'
import { AnnouncementsPage } from '@/pages/announcements/AnnouncementsPage'
import { AnnouncementWritePage } from '@/pages/announcements/AnnouncementWritePage'
import { PrivacyPage } from '@/pages/legal/PrivacyPage'
import { TermsPage } from '@/pages/legal/TermsPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProfileEditPage } from '@/pages/ProfileEditPage'
import { SignupPage } from '@/pages/SignupPage'
import { WithdrawPage } from '@/pages/WithdrawPage'
import { HomeTab } from '@/pages/tabs/HomeTab'
import { AttendanceTab } from '@/pages/tabs/AttendanceTab'
import { ClassesTab } from '@/pages/tabs/ClassesTab'
import { NotificationsTab } from '@/pages/tabs/NotificationsTab'
import { LockedTab } from '@/pages/tabs/PlaceholderTabs'
import { SettingsTab } from '@/pages/tabs/SettingsTab'

function isNaverCallback() {
  return window.location.pathname === NAVER_CALLBACK_PATH
}

/** 약관·처리방침은 로그인 없이 볼 수 있어야 하므로 로그인 확인보다 먼저 처리한다 */
function App() {
  return (
    <Routes>
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  )
}

function MainApp() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [guest, setGuest] = useState(false)
  const [naverPending, setNaverPending] = useState(isNaverCallback)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loginNotice, setLoginNotice] = useState<string | null>(null)
  const user = session?.user ?? null
  const { profile, error: profileError, setProfile, reload: reloadProfile } = useProfile(user?.id)

  useEffect(() => {
    if (!isNaverCallback()) return
    completeNaverSignIn()
      .catch((e) => setAuthError(e instanceof Error ? e.message : '네이버 로그인에 실패했어요.'))
      .finally(() => {
        navigate('/', { replace: true })
        setNaverPending(false)
      })
  }, [navigate])

  if (!user && !loading && !naverPending && !guest) {
    return <LoginPage onGuest={() => setGuest(true)} error={authError} notice={loginNotice} />
  }

  if (user && profileError) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-semibold">회원 정보를 불러오지 못했어요.</p>
        <Button onClick={reloadProfile}>다시 시도</Button>
      </main>
    )
  }

  if (loading || naverPending || (user && profile === undefined)) {
    return (
      <main className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        로그인 확인 중…
      </main>
    )
  }

  // 로그인은 했지만 회원 정보가 없으면 회원가입부터
  if (user && profile === null) {
    return <SignupPage user={user} onComplete={setProfile} />
  }

  const isGuest = !user
  const isAdmin = checkAdmin(user)
  const goLogin = () => {
    setGuest(false)
    navigate('/', { replace: true })
  }
  /** 게스트에게 잠긴 탭이면 로그인 안내로 바꾼다 */
  const tabElement = (key: (typeof TABS)[number]['key'], element: ReactElement) => {
    const tab = TABS.find((t) => t.key === key)!
    return isGuest && !tab.guest ? <LockedTab label={tab.label} onLogin={goLogin} /> : element
  }

  return (
    <UnreadProvider enabled={!!user}>
      <AppShell isGuest={isGuest}>
        <Routes>
          <Route index element={<HomeTab profile={profile ?? null} onLogin={goLogin} />} />
          <Route path="attendance" element={tabElement('attendance', user ? <AttendanceTab userId={user.id} /> : <></>)} />
          <Route path="classes" element={tabElement('classes', user ? <ClassesTab userId={user.id} /> : <></>)} />
          <Route path="notices" element={tabElement('notices', user ? <NotificationsTab userId={user.id} /> : <></>)} />
          <Route
            path="settings/profile"
            element={profile ? <ProfileEditPage profile={profile} onSaved={setProfile} /> : <Navigate to="/" replace />}
          />
          <Route
            path="settings/withdraw"
            element={
              user ? (
                <WithdrawPage
                  onDone={() => {
                    setLoginNotice('탈퇴가 완료되었어요. 그동안 이용해 주셔서 감사합니다.')
                    navigate('/', { replace: true })
                  }}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="settings" element={<SettingsTab user={user} profile={profile ?? null} isAdmin={isAdmin} onLogin={goLogin} />} />
          <Route path="announcements" element={<AnnouncementsPage isAdmin={isAdmin} />} />
          <Route
            path="announcements/new"
            element={isAdmin ? <AnnouncementWritePage /> : <Navigate to="/announcements" replace />}
          />
          <Route path="announcements/:id" element={<AnnouncementDetailPage isAdmin={isAdmin} />} />
          {/* 학원: 로그인(회원가입 완료) 사용자만 */}
          <Route
            path="academies/join"
            element={profile ? <AcademyJoinPage profile={profile} /> : <LockedTab label="학원 가입" onLogin={goLogin} />}
          />
          <Route
            path="academies/new"
            element={
              profile?.member_type === 'director' ? <AcademyRegisterPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="academies/:id"
            element={user ? <AcademyDetailPage userId={user.id} /> : <LockedTab label="학원" onLogin={goLogin} />}
          />
          <Route path="academies/:id/message" element={user ? <AcademyMessagePage /> : <Navigate to="/" replace />} />
          <Route
            path="academies/:id/students"
            element={user ? <StudentsPage userId={user.id} /> : <LockedTab label="학생 명단" onLogin={goLogin} />}
          />
          {/* 반·출석: 권한은 DB 가 확인하고, 화면은 역할에 맞게 버튼을 숨긴다 */}
          <Route path="academies/:academyId/classes/new" element={user ? <ClassFormPage /> : <Navigate to="/" replace />} />
          <Route path="classes/:id/edit" element={user ? <ClassFormPage /> : <Navigate to="/" replace />} />
          <Route
            path="classes/:id/attendance"
            element={user ? <AttendanceCheckPage /> : <LockedTab label="출석 체크" onLogin={goLogin} />}
          />
          <Route
            path="classes/:id"
            element={user ? <ClassDetailPage userId={user.id} /> : <LockedTab label="반" onLogin={goLogin} />}
          />
          <Route path="admin/academies" element={isAdmin ? <AdminAcademiesPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </UnreadProvider>
  )
}

export default App
