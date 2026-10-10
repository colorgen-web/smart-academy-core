import {
  Bell,
  BellRing,
  CheckCheck,
  ClipboardCheck,
  Gauge,
  Megaphone,
  School,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMySchedule } from '@/hooks/useMySchedule'
import { useUnread } from '@/hooks/useUnread'
import { formatRelative } from '@/lib/date'
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_PAGE,
  type AppNotification,
  type NotificationType,
} from '@/lib/notifications'
import { cn } from '@/lib/utils'

const ICON: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  attendance: { icon: ClipboardCheck, tone: 'bg-success/15 text-success' },
  join_request: { icon: UserPlus, tone: 'bg-accent text-accent-foreground' },
  membership: { icon: UserRoundCheck, tone: 'bg-accent text-accent-foreground' },
  academy_request: { icon: School, tone: 'bg-warning/25 text-warning-foreground dark:text-warning' },
  academy_review: { icon: School, tone: 'bg-accent text-accent-foreground' },
  academy_message: { icon: Megaphone, tone: 'bg-warning/25 text-warning-foreground dark:text-warning' },
  member_left: { icon: UserMinus, tone: 'bg-muted text-muted-foreground' },
  lesson_feedback: { icon: Gauge, tone: 'bg-accent text-accent-foreground' },
}

/** 알림 탭: 최신순 목록, 누르면 읽음 처리 후 관련 화면으로 */
export function NotificationsTab({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const unread = useUnread()
  const schedule = useMySchedule(userId)
  const [items, setItems] = useState<AppNotification[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchNotifications(0).then(
      (rows) => {
        if (cancelled) return
        setItems(rows)
        setHasMore(rows.length === NOTIFICATION_PAGE)
        setState('ready')
      },
      () => !cancelled && setState('error'),
    )
    return () => {
      cancelled = true
    }
  }, [userId])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const rows = await fetchNotifications(items.length)
      setItems((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))])
      setHasMore(rows.length === NOTIFICATION_PAGE)
    } finally {
      setLoadingMore(false)
    }
  }

  const open = async (n: AppNotification) => {
    if (!n.read_at) {
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p)))
      markNotificationRead(n.id).then(unread.refresh, () => {})
    }
    if (n.link && n.link !== '/notices') navigate(n.link)
  }

  const readAll = async () => {
    const now = new Date().toISOString()
    setItems((prev) => prev.map((p) => (p.read_at ? p : { ...p, read_at: now })))
    try {
      await markAllNotificationsRead()
    } finally {
      unread.refresh()
    }
  }

  const remove = async (n: AppNotification) => {
    setItems((prev) => prev.filter((p) => p.id !== n.id))
    try {
      await deleteNotification(n.id)
    } catch {
      setItems((prev) => [...prev, n].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id))
    } finally {
      unread.refresh()
    }
  }

  const directorAcademies = schedule.data?.staffAcademies.filter((a) => a.role === 'director') ?? []
  const hasUnread = items.some((n) => !n.read_at)

  return (
    <div className="flex flex-col gap-4">
      {directorAcademies.length > 0 && (
        <Card size="sm" className="gap-0 py-0">
          {directorAcademies.map((a) => (
            <Link
              key={a.id}
              to={`/academies/${a.id}/message`}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/60"
            >
              <Send className="size-4 text-primary" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground"> 회원에게 알림 보내기</span>
              </span>
            </Link>
          ))}
        </Card>
      )}

      <div className="flex items-center">
        <h2 className="flex-1 font-semibold">받은 알림</h2>
        {hasUnread && (
          <Button variant="ghost" size="sm" onClick={readAll}>
            <CheckCheck data-icon="inline-start" />
            모두 읽음
          </Button>
        )}
      </div>

      {state === 'loading' ? (
        <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : state === 'error' ? (
        <p className="py-10 text-center text-sm text-destructive">알림을 불러오지 못했어요.</p>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="새 알림이 없어요" description="출석, 가입 승인, 학원 알림이 여기에 모여요." />
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {items.map((n) => {
              const { icon: Icon, tone } = ICON[n.type] ?? { icon: BellRing, tone: 'bg-muted text-muted-foreground' }
              return (
                <li key={n.id} className={cn('group relative', !n.read_at && 'bg-accent/30')}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 pr-11 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', tone)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={cn('min-w-0 flex-1 truncate', !n.read_at && 'font-semibold')}>{n.title}</span>
                        <time dateTime={n.created_at} className="shrink-0 text-xs text-muted-foreground">
                          {formatRelative(n.created_at)}
                        </time>
                      </span>
                      {n.body && (
                        <span className="mt-0.5 line-clamp-2 block text-sm whitespace-pre-line text-muted-foreground">
                          {n.body}
                        </span>
                      )}
                    </span>
                    {!n.read_at && (
                      <span className="absolute top-4 left-1.5 size-1.5 rounded-full bg-primary" aria-label="읽지 않음" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(n)}
                    aria-label="알림 삭제"
                    className="absolute top-2.5 right-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {hasMore && (
        <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? '불러오는 중…' : '이전 알림 더 보기'}
        </Button>
      )}
    </div>
  )
}
