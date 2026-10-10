import { FlaskConical, Settings2, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { PERSONAS, stopVerifyMode, switchPersona, type PersonaKey } from '@/verify/mode'

/** 검증 모드 표시줄: 지금 어떤 역할로 보는지 + 역할 바꾸기 + 관리 + 끝내기 */
export function VerifyBanner({ persona }: { persona: PersonaKey }) {
  const navigate = useNavigate()

  return (
    <div className="bg-warning text-warning-foreground pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-screen-sm items-center gap-2 px-4 py-2 text-sm">
        <FlaskConical className="size-4 shrink-0" />
        <span className="shrink-0 font-semibold">검증 모드</span>
        <select
          aria-label="역할 바꾸기"
          value={persona}
          onChange={(e) => {
            switchPersona(e.target.value as PersonaKey)
            navigate('/', { replace: true })
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-warning-foreground/25 bg-background/70 px-2 text-sm text-foreground"
        >
          {PERSONAS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.role} · {p.name}
            </option>
          ))}
        </select>
        <Link
          to="/admin/verify"
          aria-label="검증 모드 관리"
          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-warning-foreground/10"
        >
          <Settings2 className="size-4" />
        </Link>
        <button
          type="button"
          aria-label="검증 모드 끝내기"
          onClick={() => {
            stopVerifyMode()
            navigate('/', { replace: true })
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-warning-foreground/10"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
