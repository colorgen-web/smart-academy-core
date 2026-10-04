import { Button } from '@/components/ui/button'

type GuestHomePageProps = {
  onLogin: () => void
}

export function GuestHomePage({ onLogin }: GuestHomePageProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        게스트 모드
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Smart Academy 둘러보기</h1>
      <p className="text-sm text-muted-foreground">
        로그인하면 수업 신청과 학습 기록 저장을 이용할 수 있어요.
      </p>
      <Button onClick={onLogin}>로그인하러 가기</Button>
    </main>
  )
}
