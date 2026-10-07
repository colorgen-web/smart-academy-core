import { ChevronRight, LogIn, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { MyAcademies } from '@/components/academies/MyAcademies'
import { LatestAnnouncements } from '@/components/announcements/LatestAnnouncements'
import { Button } from '@/components/ui/button'
import { HomeSummary } from '@/components/HomeSummary'
import { Card, CardContent } from '@/components/ui/card'
import { usePhoneVerificationRequired } from '@/hooks/usePhoneVerificationRequired'
import type { Profile } from '@/lib/profile'

type HomeTabProps = {
  /** null 이면 게스트 */
  profile: Profile | null
  onLogin: () => void
}

export function HomeTab({ profile, onLogin }: HomeTabProps) {
  const name = profile?.name ?? null
  const verificationRequired = usePhoneVerificationRequired()
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

      {verificationRequired && profile && profile.phone_verified_at === null && (
        <Link
          to="/settings/profile"
          className="flex items-center gap-3 rounded-2xl bg-warning/25 px-4 py-3 text-warning-foreground transition-colors hover:bg-warning/35 dark:text-warning"
        >
          <ShieldAlert className="size-5 shrink-0" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">휴대폰 번호를 인증해 주세요</span>
            <span className="block text-xs opacity-90">
              {profile.member_type === 'parent' || profile.member_type === 'student'
                ? '인증된 번호로만 자녀(본인) 정보와 출석 알림이 연결돼요.'
                : '문자 인증으로 본인 번호를 확인해요.'}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      )}

      <HomeSummary userId={profile?.id} />

      {profile && <MyAcademies profile={profile} />}

      <LatestAnnouncements />
    </div>
  )
}
