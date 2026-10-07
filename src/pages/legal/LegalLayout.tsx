import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { LEGAL_EFFECTIVE_DATE, SERVICE_NAME } from '@/legal/operator'

/** 약관·처리방침 공통 틀. 로그인 없이도 볼 수 있다 */
export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/', { replace: true }))

  return (
    <div className="min-h-svh bg-background">
      <header className="glass sticky top-0 z-30 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-screen-sm items-center gap-1 px-4">
          <button
            type="button"
            onClick={goBack}
            aria-label="뒤로"
            className="-ml-2 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="font-semibold">{title}</span>
        </div>
      </header>

      <main className="mx-auto max-w-screen-sm px-4 pt-6 pb-[calc(3rem+env(safe-area-inset-bottom))]">
        <h1 className="text-2xl font-semibold tracking-tight">
          {SERVICE_NAME} {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">시행일: {LEGAL_EFFECTIVE_DATE}</p>

        <div className="legal mt-6 flex flex-col gap-7 text-[15px] leading-relaxed">{children}</div>

        <nav className="mt-10 flex justify-center gap-4 border-t pt-5 text-sm text-muted-foreground">
          <Link to="/terms" replace className="hover:text-foreground hover:underline">
            이용약관
          </Link>
          <Link to="/privacy" replace className="font-semibold hover:text-foreground hover:underline">
            개인정보 처리방침
          </Link>
        </nav>
      </main>
    </div>
  )
}

/** 조항 하나: 제목 + 본문 */
export function Article({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-foreground/90">{children}</div>
    </section>
  )
}

/** 번호 목록 ① ② … */
export function Items({ children }: { children: ReactNode }) {
  return <ol className="flex list-none flex-col gap-1.5 pl-0">{children}</ol>
}

export function Item({ n, children }: { n: number; children: ReactNode }) {
  const circled = '①②③④⑤⑥⑦⑧⑨⑩'[n - 1] ?? `${n}.`
  return (
    <li className="flex gap-1.5">
      <span className="shrink-0">{circled}</span>
      <span>{children}</span>
    </li>
  )
}

/** 표. 열이 많은 표만 휴대폰에서 가로로 스크롤한다 */
export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const wide = head.length > 3
  return (
    <div className={wide ? '-mx-4 overflow-x-auto px-4' : undefined}>
      <table className={`w-full border-collapse text-sm ${wide ? 'min-w-[40rem]' : ''}`}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border bg-muted px-2.5 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border px-2.5 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
