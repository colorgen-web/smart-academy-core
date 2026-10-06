import { LogIn } from 'lucide-react'
import { useState } from 'react'

import { MyAcademies } from '@/components/academies/MyAcademies'
import { LatestAnnouncements } from '@/components/announcements/LatestAnnouncements'
import { Button } from '@/components/ui/button'
import { HomeSummary } from '@/components/HomeSummary'
import { Card, CardContent } from '@/components/ui/card'
import type { Profile } from '@/lib/profile'

type HomeTabProps = {
  /** null 이면 게스트 */
  profile: Profile | null
  onLogin: () => void
}

export function HomeTab({ profile, onLogin }: HomeTabProps) {
  const name = profile?.name ?? null
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

      {!profile && (
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

      <HomeSummary userId={profile?.id} />

      {profile && <MyAcademies profile={profile} />}

      <LatestAnnouncements />
    </div>
  )
}
