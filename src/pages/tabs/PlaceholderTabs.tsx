import { Bell, BookOpen, ClipboardCheck, Lock } from 'lucide-react'

import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

// 각 탭의 실제 화면은 데이터 설계(학원/반/수업/출석) 후 채운다

export function AttendanceTab() {
  return <EmptyState icon={ClipboardCheck} title="출석 기록이 없어요" description="수업이 등록되면 여기서 출석을 체크할 수 있어요." />
}

export function ClassesTab() {
  return <EmptyState icon={BookOpen} title="등록된 수업이 없어요" description="반과 수업 일정이 여기에 표시돼요." />
}

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
