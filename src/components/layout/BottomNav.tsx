import { Lock } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'

import { cn } from '@/lib/utils'
import { tabFromPath, TABS } from '@/components/layout/tabs'

type BottomNavProps = {
  isGuest: boolean
}

/** 모바일 하단 고정 탭. 게스트에게 잠긴 탭도 누를 수 있고, 내용 영역에서 로그인 안내를 보여준다. */
export function BottomNav({ isGuest }: BottomNavProps) {
  const navigate = useNavigate()
  const active = tabFromPath(useLocation().pathname).key
  return (
    <nav
      aria-label="주요 메뉴"
      className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-screen-sm grid-cols-5">
        {TABS.map(({ key, path, label, icon: Icon, guest }) => {
          const selected = key === active
          const locked = isGuest && !guest
          return (
            <li key={key}>
              <button
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => navigate(path)}
                className={cn(
                  'relative flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {selected && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" aria-hidden="true" />
                )}
                <span className="relative">
                  <Icon className="size-6" strokeWidth={selected ? 2.4 : 2} />
                  {locked && (
                    <Lock
                      className="absolute -right-1.5 -bottom-1 size-3 rounded-full bg-background p-px"
                      aria-label="로그인 필요"
                    />
                  )}
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
