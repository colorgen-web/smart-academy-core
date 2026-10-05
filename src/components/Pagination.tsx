import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

type PaginationProps = {
  page: number
  totalPages: number
  /** 페이지 번호 → 링크 주소 */
  href: (page: number) => string
  /** 한 번에 보여줄 페이지 번호 개수 (휴대폰 폭 기준 5) */
  window?: number
}

/** « ‹ 1 2 3 4 5 › » 형태. 번호는 window 개씩 묶어서 보여준다 (6~10, 11~15 …) */
export function Pagination({ page, totalPages, href, window = 5 }: PaginationProps) {
  if (totalPages <= 1) return null

  const groupStart = Math.floor((page - 1) / window) * window + 1
  const groupEnd = Math.min(groupStart + window - 1, totalPages)
  const pages = Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i)

  return (
    <nav aria-label="페이지 이동" className="flex items-center justify-center gap-1">
      <PageLink to={href(1)} disabled={page === 1} label="첫 페이지">
        <ChevronsLeft className="size-4" />
      </PageLink>
      <PageLink to={href(page - 1)} disabled={page === 1} label="이전 페이지">
        <ChevronLeft className="size-4" />
      </PageLink>
      {pages.map((n) => (
        <PageLink key={n} to={href(n)} current={n === page} label={`${n} 페이지`}>
          {n}
        </PageLink>
      ))}
      <PageLink to={href(page + 1)} disabled={page === totalPages} label="다음 페이지">
        <ChevronRight className="size-4" />
      </PageLink>
      <PageLink to={href(totalPages)} disabled={page === totalPages} label="마지막 페이지">
        <ChevronsRight className="size-4" />
      </PageLink>
    </nav>
  )
}

function PageLink({
  to,
  disabled,
  current,
  label,
  children,
}: {
  to: string
  disabled?: boolean
  current?: boolean
  label: string
  children: React.ReactNode
}) {
  const className = cn(
    'flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors',
    current ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    disabled && 'pointer-events-none opacity-40',
  )
  if (disabled) {
    return (
      <span aria-label={label} aria-disabled="true" className={className}>
        {children}
      </span>
    )
  }
  return (
    <Link to={to} aria-label={label} aria-current={current ? 'page' : undefined} className={className}>
      {children}
    </Link>
  )
}
