import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router'

import { ATTENDANCE_TINT } from '@/components/classes/attendanceTone'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { useMySchedule, type MySchedule } from '@/hooks/useMySchedule'
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_ORDER,
  classesOnWeekday,
  fetchAttendance,
  fetchEnrollmentCounts,
  type AttendanceRecord,
} from '@/lib/classes'
import { addDays, formatDayLabel, formatTime, todayKST, weekdayOf } from '@/lib/date'
import { cn } from '@/lib/utils'

/** 출석 탭: 원장·강사는 오늘 출석 체크 현황, 가족은 자녀 출석 기록 */
export function AttendanceTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = useMySchedule(userId)

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중…</p>
  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm">
        <p className="text-destructive">출석 정보를 불러오지 못했어요.</p>
        <Button variant="outline" size="sm" onClick={reload}>
          다시 시도
        </Button>
      </div>
    )
  }
  if (data.staffAcademies.length === 0 && data.children.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="출석 기록이 없어요"
        description="학원에 가입하고 승인되면 출석을 확인할 수 있어요."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {data.staffAcademies.length > 0 && <TodayChecks data={data} />}
      {data.children.length > 0 && <ChildrenHistory data={data} />}
    </div>
  )
}

/** 원장·강사: 오늘 수업별 체크 현황 */
function TodayChecks({ data }: { data: MySchedule }) {
  const today = todayKST()
  const items = classesOnWeekday(data.staffClasses, weekdayOf(today))
  const classIds = [...new Set(items.map((i) => i.cls.id))]
  const progress = useAsync(async () => {
    const [enrolled, records] = await Promise.all([
      fetchEnrollmentCounts(classIds),
      fetchAttendance({ classIds, from: today, to: today }),
    ])
    const checked = new Map<number, number>()
    for (const r of records) checked.set(r.class_id, (checked.get(r.class_id) ?? 0) + 1)
    return { enrolled, checked }
  }, [classIds.join(','), today])

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">오늘 출석 체크</h2>
        <p className="text-sm text-muted-foreground">{formatDayLabel(today)}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          오늘은 수업이 없어요. 다른 날 출석은 반 화면에서 체크할 수 있어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(({ cls, schedule }) => {
            const total = progress.data?.enrolled.get(cls.id) ?? 0
            const done = progress.data?.checked.get(cls.id) ?? 0
            const complete = total > 0 && done >= total
            return (
              <li key={`${cls.id}-${schedule.start_time}`}>
                <Link
                  to={`/classes/${cls.id}/attendance`}
                  className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 hover:bg-muted/60"
                >
                  <span className="w-12 shrink-0 font-semibold tabular-nums">{formatTime(schedule.start_time)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{cls.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{cls.academy.name}</p>
                  </div>
                  {progress.data && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                        complete ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {complete ? '완료' : `${done}/${total}`}
                    </span>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** 가족: 자녀별 최근 30일 출석 */
function ChildrenHistory({ data }: { data: MySchedule }) {
  const today = todayKST()
  const from = addDays(today, -29)
  const ids = data.children.map((c) => c.id)
  const records = useAsync(() => fetchAttendance({ studentIds: ids, from, to: today }), [ids.join(','), from, today])
  const className = new Map(data.childClasses.map(({ cls }) => [cls.id, cls.name]))

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">{data.children.length > 1 ? '자녀 출석' : '출석 기록'}</h2>
        <p className="text-sm text-muted-foreground">최근 30일</p>
      </div>
      {records.loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : records.error ? (
        <p className="text-sm text-destructive">출석 기록을 불러오지 못했어요.</p>
      ) : (
        data.children.map((child) => {
          const mine = (records.data ?? []).filter((r) => r.student_id === child.id)
          return (
            <Card key={child.id} className="gap-0 py-0">
              <div className="border-b px-4 py-3">
                <p className="font-semibold">
                  {child.name}
                  {child.grade && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{child.grade}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{child.academy.name}</p>
              </div>
              <Summary records={mine} />
              {mine.length === 0 ? (
                <p className="px-4 py-5 text-center text-sm text-muted-foreground">최근 출석 기록이 없어요.</p>
              ) : (
                <ul className="divide-y">
                  {mine.map((r) => (
                    <li key={`${r.class_id}-${r.date}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{formatDayLabel(r.date)}</span>
                      <span className="min-w-0 flex-1 truncate">{className.get(r.class_id) ?? '수업'}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ATTENDANCE_TINT[r.status])}>
                        {ATTENDANCE_LABEL[r.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })
      )}
    </section>
  )
}

function Summary({ records }: { records: AttendanceRecord[] }) {
  return (
    <div className="grid grid-cols-4 border-b text-center">
      {ATTENDANCE_ORDER.map((st) => (
        <div key={st} className="py-2">
          <p className="text-xs text-muted-foreground">{ATTENDANCE_LABEL[st]}</p>
          <p className="font-semibold tabular-nums">{records.filter((r) => r.status === st).length}</p>
        </div>
      ))}
    </div>
  )
}
