import type { User } from '@supabase/supabase-js'
import { Bell, CalendarDays, ClipboardCheck, LogIn } from 'lucide-react'
import { useState } from 'react'

import { LatestAnnouncements } from '@/components/announcements/LatestAnnouncements'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getUserProfile } from '@/lib/user'

type HomeTabProps = {
  user: User | null
  onLogin: () => void
}

// 데이터 연결 전이라 값은 '—' 로 표시한다 (학원/수업 테이블 설계 후 연결)
const SUMMARY = [
  { label: '오늘 수업', icon: CalendarDays, tone: 'bg-accent text-accent-foreground' },
  { label: '이번 주 출석', icon: ClipboardCheck, tone: 'bg-success/15 text-success' },
  { label: '새 알림', icon: Bell, tone: 'bg-warning/25 text-warning-foreground dark:text-warning' },
]

export function HomeTab({ user, onLogin }: HomeTabProps) {
  const name = user ? getUserProfile(user).name : null
  const [today] = useState(() =>
    new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }),
  )

  return (
    <div className="flex flex-col gap-5">
      <section>
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {name ? `${name}님, 안녕하세요` : '둘러보기 중이에요'}
        </h1>
      </section>

      {!user && (
        <Card className="bg-primary text-primary-foreground ring-0">
          <CardContent className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold">로그인하고 모든 기능을 써 보세요</p>
              <p className="text-sm opacity-90">출석 체크, 수업 일정, 알림을 받을 수 있어요.</p>
            </div>
            <Button variant="secondary" onClick={onLogin}>
              <LogIn data-icon="inline-start" />
              로그인
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-3 gap-3">
        {SUMMARY.map(({ label, icon: Icon, tone }) => (
          <Card key={label} size="sm">
            <CardContent className="flex flex-col gap-2">
              <span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="size-4" />
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xl font-semibold">—</span>
            </CardContent>
          </Card>
        ))}
      </section>

      <LatestAnnouncements />
    </div>
  )
}
