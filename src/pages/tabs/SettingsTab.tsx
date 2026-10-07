import type { User } from '@supabase/supabase-js'
import { ChevronRight, LogIn, LogOut, Monitor, Moon, School, Sun, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { signOut } from '@/lib/auth'
import { maskPhone, MEMBER_TYPE_LABEL, PROVIDER_LABEL, socialInfo, type Profile } from '@/lib/profile'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
  { value: 'system', label: '시스템', icon: Monitor },
]

type SettingsTabProps = {
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  onLogin: () => void
}

export function SettingsTab({ user, profile, isAdmin, onLogin }: SettingsTabProps) {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const avatarUrl = user ? socialInfo(user).avatarUrl : undefined
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (!window.confirm('로그아웃할까요?')) return
    setSigningOut(true)
    // 다음 로그인은 홈에서 시작하도록 먼저 이동 (세션이 지워지면 로그인 화면으로 바뀐다)
    navigate('/', { replace: true })
    await signOut()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserRound className="size-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold">
              <span className="truncate">{profile?.name ?? '게스트'}</span>
              {profile && <Badge variant="outline">{MEMBER_TYPE_LABEL[profile.member_type]}</Badge>}
              {isAdmin && <Badge>관리자</Badge>}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {profile ? (profile.email ?? maskPhone(profile.phone)) : '로그인하지 않았어요'}
            </p>
          </div>
          {profile && <Badge variant="secondary">{PROVIDER_LABEL[profile.provider]}</Badge>}
        </CardContent>
      </Card>

      {profile && (
        <Card size="sm">
          <CardContent>
            <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">휴대폰</dt>
              <dd className="tabular-nums">{maskPhone(profile.phone)}</dd>
              <dt className="text-muted-foreground">이메일</dt>
              <dd className="truncate">{profile.email ?? '—'}</dd>
              <dt className="text-muted-foreground">가입 방법</dt>
              <dd>{PROVIDER_LABEL[profile.provider]}</dd>
            </dl>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>운영자 메뉴</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              to="/admin/academies"
              className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
            >
              <School className="size-4 text-primary" />
              <span className="flex-1">학원 승인 관리</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>화면 모드</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="화면 모드" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
                  theme === value
                    ? 'bg-card text-foreground shadow-sm dark:bg-accent dark:text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {user ? (
        <Button variant="outline" size="lg" className="h-11" onClick={handleSignOut} disabled={signingOut}>
          <LogOut data-icon="inline-start" />
          {signingOut ? '로그아웃 중…' : '로그아웃'}
        </Button>
      ) : (
        <Button size="lg" className="h-11" onClick={onLogin}>
          <LogIn data-icon="inline-start" />
          로그인하러 가기
        </Button>
      )}

      <nav className="flex justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/terms" className="hover:text-foreground hover:underline">
          이용약관
        </Link>
        <Link to="/privacy" className="font-semibold hover:text-foreground hover:underline">
          개인정보 처리방침
        </Link>
      </nav>

      <p className="text-center text-xs text-muted-foreground">Smart Academy v{__APP_VERSION__}</p>

      {user && (
        <Link
          to="/settings/withdraw"
          className="self-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          회원 탈퇴
        </Link>
      )}
    </div>
  )
}
