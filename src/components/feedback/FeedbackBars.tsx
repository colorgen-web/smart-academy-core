import { useState } from 'react'

import { formatDayLabel } from '@/lib/date'
import { RATING_LABEL, type LessonFeedback } from '@/lib/feedback'
import { cn } from '@/lib/utils'

/**
 * 최근 수업 이해도 막대 (오래된 수업 → 최근 수업, 높이 = 1~5단계).
 * 막대를 누르거나 올리면 아래에 그 수업의 날짜·단계가 나온다 (기본은 가장 최근 수업).
 */
export function FeedbackBars({
  records,
  max = 10,
  compact = false,
}: {
  records: Pick<LessonFeedback, 'date' | 'rating'>[]
  max?: number
  compact?: boolean
}) {
  const shown = [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-max)
  const [active, setActive] = useState<number | null>(null)
  if (shown.length === 0) return null
  const current = shown[active ?? shown.length - 1]

  return (
    <figure className="flex flex-col gap-1">
      <div
        className={cn('flex items-end gap-0.5 border-b border-border', compact ? 'h-8' : 'h-16')}
        onPointerLeave={() => setActive(null)}
      >
        {shown.map((r, i) => (
          <button
            key={r.date}
            type="button"
            className="flex h-full max-w-6 flex-1 items-end outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            aria-label={`${formatDayLabel(r.date)} 이해도 ${r.rating}단계 ${RATING_LABEL[r.rating]}`}
          >
            <span
              className={cn(
                'w-full rounded-t-[4px] bg-primary transition-opacity',
                active !== null && active !== i && 'opacity-40',
              )}
              style={{ height: `${(r.rating / 5) * 100}%` }}
            />
          </button>
        ))}
      </div>
      {!compact && (
        <figcaption className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatDayLabel(current.date)}</span>
          <span className="font-medium text-foreground">
            {current.rating}단계 · {RATING_LABEL[current.rating]}
          </span>
        </figcaption>
      )}
    </figure>
  )
}

/** 평균 이해도 (5점 만점) + 최근 4회가 그 전 4회보다 얼마나 바뀌었나 */
export function FeedbackAverage({ average, delta }: { average: number | null; delta: number | null }) {
  if (average === null) return null
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-2xl font-semibold tabular-nums">{average.toFixed(1)}</span>
      <span className="text-sm text-muted-foreground">/ 5</span>
      {delta !== null && Math.abs(delta) >= 0.1 && (
        <span className="ml-1 text-xs text-muted-foreground tabular-nums">
          최근 4회 {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} (직전 4회 대비)
        </span>
      )}
    </p>
  )
}
