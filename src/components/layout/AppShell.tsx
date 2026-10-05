import type { ReactNode } from 'react'

import { BottomNav } from '@/components/layout/BottomNav'
import { TABS, type TabKey } from '@/components/layout/tabs'

type AppShellProps = {
  active: TabKey
  onTabChange: (tab: TabKey) => void
  isGuest: boolean
  children: ReactNode
}

/** 상단 헤더 + 내용 + 하단 탭. 모든 로그인 이후 화면(및 게스트 둘러보기)의 공통 틀 */
export function AppShell({ active, onTabChange, isGuest, children }: AppShellProps) {
  const title = TABS.find((tab) => tab.key === active)?.label

  return (
    <div className="min-h-svh">
      <header className="glass sticky top-0 z-30 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-screen-sm items-center gap-2 px-4">
          <img src="/favicon.svg" alt="" className="size-7" />
          <span className="font-semibold">Smart Academy</span>
          {active !== 'home' && <span className="text-muted-foreground">· {title}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-screen-sm px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <BottomNav active={active} onChange={onTabChange} isGuest={isGuest} />
    </div>
  )
}
