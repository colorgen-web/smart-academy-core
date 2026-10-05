import type { User } from '@supabase/supabase-js'
import { LogIn, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { signOut } from '@/lib/auth'
import { getUserProfile } from '@/lib/user'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
  { value: 'system', label: '시스템', icon: Monitor },
]

type SettingsTabProps = {
  user: User | null
  onLogin: () => void
}

export function SettingsTab({ user, onLogin }: SettingsTabProps) {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const profile = user ? getUserProfile(user) : null
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
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserRound className="size-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{profile?.name ?? '게스트'}</p>
            <p className="truncate text-sm text-muted-foreground">
              {profile ? profile.email : '로그인하지 않았어요'}
            </p>
          </div>
          {profile?.providerLabel && <Badge variant="secondary">{profile.providerLabel}</Badge>}
        </CardContent>
      </Card>

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

      <p className="text-center text-xs text-muted-foreground">Smart Academy v{__APP_VERSION__}</p>
    </div>
  )
}
