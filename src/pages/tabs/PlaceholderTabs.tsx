import { Bell, Lock } from 'lucide-react'

import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

// 알림 탭은 아직 준비 중

export function NoticesTab() {
  return <EmptyState icon={Bell} title="새 알림이 없어요" description="학원 공지와 출결 알림이 여기에 모여요." />
}

export function LockedTab({ label, onLogin }: { label: string; onLogin: () => void }) {
  return (
    <EmptyState
      icon={Lock}
      title={`${label}은(는) 로그인 후 이용할 수 있어요`}
      description="게스트 둘러보기에서는 홈과 설정만 볼 수 있어요."
      action={<Button onClick={onLogin}>로그인하러 가기</Button>}
    />
  )
}
