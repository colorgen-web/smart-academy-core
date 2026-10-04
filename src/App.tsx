import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Smart Academy</h1>
      <p className="text-muted-foreground">Tailwind CSS + shadcn/ui 설정 완료</p>
      <div className="flex gap-2">
        <Button>시작하기</Button>
        <Button variant="outline">더 알아보기</Button>
      </div>
    </main>
  )
}

export default App
