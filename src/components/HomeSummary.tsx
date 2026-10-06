import { Bell, CalendarDays, ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router'

import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { useMySchedule } from '@/hooks/useMySchedule'
import { classesOnWeekday, fetchAttendance } from '@/lib/classes'
import { todayKST, weekdayOf, weekRange } from '@/lib/date'

/** 홈 요약 카드: 오늘 수업 / 이번 주 출석(가족) 또는 운영 중인 반(원장·강사) / 새 알림 */
export function HomeSummary({ userId }: { userId?: string }) {
  const schedule = useMySchedule(userId)
  const today = todayKST()
  const { start, end } = weekRange(today)
  const childIds = schedule.data?.children.map((c) => c.id) ?? []
  const week = useAsync(
    () => (childIds.length ? fetchAttendance({ studentIds: childIds, from: start, to: end }) : Promise.resolve([])),
    [childIds.join(','), start, end],
  )

  const d = schedule.data
  let todayCount: string = '—'
  let second = { label: '이번 주 출석', value: '—' }
  if (d && userId) {
    const all = [...d.staffClasses, ...d.childClasses.map((c) => c.cls)]
    const unique = new Set(classesOnWeekday(all, weekdayOf(today)).map((i) => `${i.cls.id}-${i.schedule.start_time}`))
    todayCount = String(unique.size)
    if (d.children.length > 0 && week.data) {
      const attended = week.data.filter((r) => r.status === 'present' || r.status === 'late').length
      second = { label: '이번 주 출석', value: week.data.length ? `${attended}/${week.data.length}` : '0' }
    } else if (d.staffAcademies.length > 0) {
      second = { label: '운영 중인 반', value: String(d.staffClasses.filter((c) => c.active).length) }
    }
  }

  const items = [
    { label: '오늘 수업', value: todayCount, icon: CalendarDays, tone: 'bg-accent text-accent-foreground', to: '/classes' },
    { ...second, icon: ClipboardCheck, tone: 'bg-success/15 text-success', to: '/attendance' },
    { label: '새 알림', value: '—', icon: Bell, tone: 'bg-warning/25 text-warning-foreground dark:text-warning', to: '/notices' },
  ]

  return (
    <section className="grid grid-cols-3 gap-3">
      {items.map(({ label, value, icon: Icon, tone, to }) => (
        <Link key={label} to={to} className="rounded-xl transition-transform active:scale-[0.98]">
          <Card size="sm" className="h-full">
            <CardContent className="flex flex-col gap-2">
              <span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="size-4" />
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xl font-semibold tabular-nums">{value}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </section>
  )
}
