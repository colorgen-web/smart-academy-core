import { Lock } from 'lucide-react'

import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'


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
