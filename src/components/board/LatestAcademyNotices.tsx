import { NotebookPen, Pin } from 'lucide-react'
import { Link } from 'react-router'

import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, isNew } from '@/lib/announcements'
import { fetchLatestAcademyNotices } from '@/lib/academyBoard'

/** 메인 화면: 내 학원들의 최근 공지 3개 (볼 수 있는 공지가 없으면 숨김) */
export function LatestAcademyNotices({ userId }: { userId: string }) {
  const { data } = useAsync(() => fetchLatestAcademyNotices(3), [userId])
  if (!data || data.length === 0) return null

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <NotebookPen className="size-4 text-primary" />
        <h2 className="flex-1 font-semibold">학원 공지</h2>
      </div>
      <ul className="divide-y">
        {data.map((n) => (
          <li key={n.id}>
            <Link
              to={`/academy-posts/${n.id}`}
              className="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/60"
            >
              {n.is_pinned && <Pin className="size-3.5 shrink-0 text-primary" aria-label="고정" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{n.title}</span>
                {n.academy && <span className="block truncate text-xs text-muted-foreground">{n.academy.name}</span>}
              </span>
              {isNew(n.created_at) && (
                <span className="shrink-0 rounded-sm bg-warning px-1 text-[10px] leading-4 font-bold text-warning-foreground">
                  N
                </span>
              )}
              <time dateTime={n.created_at} className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatDate(n.created_at)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
