import { Pin } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { formatDate, isNew, type AnnouncementSummary } from '@/lib/announcements'
import { cn } from '@/lib/utils'

/** 공지 한 줄 (메인/전체 목록 공용) */
export function AnnouncementRow({ item }: { item: AnnouncementSummary }) {
  return (
    <li>
      <Link
        to={`/announcements/${item.id}`}
        className={cn(
          'flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/60',
          item.is_pinned && 'bg-accent/40',
        )}
      >
        {item.is_pinned && (
          <Badge className="shrink-0 gap-1">
            <Pin data-icon="inline-start" />
            공지
          </Badge>
        )}
        <span className={cn('min-w-0 flex-1 truncate', item.is_pinned && 'font-semibold')}>{item.title}</span>
        {isNew(item.created_at) && (
          <span className="shrink-0 rounded-sm bg-warning px-1 text-[10px] leading-4 font-bold text-warning-foreground">
            N
          </span>
        )}
        <time dateTime={item.created_at} className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatDate(item.created_at)}
        </time>
      </Link>
    </li>
  )
}

/** 불러오는 동안 보여줄 자리 표시 줄 */
export function AnnouncementRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
      <span className="h-4 flex-1 animate-pulse rounded bg-muted" />
      <span className="h-3 w-16 animate-pulse rounded bg-muted" />
    </li>
  )
}
