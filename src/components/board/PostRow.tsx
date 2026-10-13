import { MessageSquare, Pin } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { formatDate, isNew } from '@/lib/announcements'
import { audienceLabel, authorLabel, type AcademyPostSummary, type BoardAuthor } from '@/lib/academyBoard'
import { cn } from '@/lib/utils'

/** 게시판 한 줄: [고정/공지] 제목 N · 작성자 · 날짜 · 댓글 수 */
export function PostRow({ post, authors }: { post: AcademyPostSummary; authors?: Map<string, BoardAuthor> }) {
  const comments = post.comments?.[0]?.count ?? 0
  const audience = post.category === 'notice' ? audienceLabel(post.audience) : null
  return (
    <li>
      <Link
        to={`/academy-posts/${post.id}`}
        className={cn(
          'flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/60',
          post.is_pinned && 'bg-accent/40',
        )}
      >
        <span className="flex items-center gap-2">
          {post.is_pinned ? (
            <Badge className="shrink-0 gap-1">
              <Pin data-icon="inline-start" />
              고정
            </Badge>
          ) : (
            post.category === 'notice' && <Badge className="shrink-0">공지</Badge>
          )}
          <span className={cn('min-w-0 flex-1 truncate', post.category === 'notice' && 'font-semibold')}>
            {post.title}
          </span>
          {isNew(post.created_at) && (
            <span className="shrink-0 rounded-sm bg-warning px-1 text-[10px] leading-4 font-bold text-warning-foreground">
              N
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{authorLabel(post.author_id, authors)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.created_at} className="shrink-0 tabular-nums">
            {formatDate(post.created_at)}
          </time>
          {audience && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{audience}에게</span>
            </>
          )}
          {comments > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5 tabular-nums" aria-label={`댓글 ${comments}개`}>
              <MessageSquare className="size-3" />
              {comments}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

export function PostRowSkeleton() {
  return (
    <li className="flex flex-col gap-2 px-4 py-3" aria-hidden="true">
      <span className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <span className="h-3 w-1/3 animate-pulse rounded bg-muted" />
    </li>
  )
}
