import { BookOpen, ChevronRight, Plus, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMySchedule, type MySchedule } from '@/hooks/useMySchedule'
import { classesOnWeekday, formatSchedules, type ClassInfo } from '@/lib/classes'
import { formatTime, todayKST, WEEKDAY_LABEL, WEEKDAY_ORDER, weekdayOf } from '@/lib/date'
import { cn } from '@/lib/utils'

/** 수업 탭: 요일별 수업 + 내 학원 반 목록 */
export function ClassesTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = useMySchedule(userId)
  const today = weekdayOf(todayKST())
  const [day, setDay] = useState(today)

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중…</p>
  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm">
        <p className="text-destructive">수업 정보를 불러오지 못했어요.</p>
        <Button variant="outline" size="sm" onClick={reload}>
          다시 시도
        </Button>
      </div>
    )
  }

  const hasStaff = data.staffAcademies.length > 0
  const hasFamily = data.children.length > 0
  if (!hasStaff && !hasFamily) {
    return (
      <EmptyState
        icon={BookOpen}
        title="아직 볼 수 있는 수업이 없어요"
        description="학원에 가입하고 승인되면 수업이 보여요. 학부모는 학원에 등록된 연락처가 가입한 번호와 같아야 자녀 수업이 보여요."
        action={
          <Button asChild variant="outline">
            <Link to="/">홈으로</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="요일" className="grid grid-cols-7 gap-1">
        {WEEKDAY_ORDER.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === day}
            onClick={() => setDay(d)}
            className={cn(
              'flex h-12 flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors',
              d === day ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground ring-1 ring-foreground/10',
            )}
          >
            {WEEKDAY_LABEL[d]}
            {d === today && <span className="text-[10px] leading-none opacity-80">오늘</span>}
          </button>
        ))}
      </div>

      <DayList data={data} day={day} />

      {hasStaff && <StaffClassList data={data} />}
    </div>
  )
}

function DayList({ data, day }: { data: MySchedule; day: number }) {
  const childName = new Map(data.children.map((c) => [c.id, c.name]))
  const staffItems = classesOnWeekday(data.staffClasses, day)
  const familyItems = classesOnWeekday(
    data.childClasses.map((c) => c.cls),
    day,
  ).map((item) => ({
    ...item,
    who: data.childClasses.find((c) => c.cls.id === item.cls.id)!.studentIds.map((id) => childName.get(id)).filter(Boolean),
  }))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">{WEEKDAY_LABEL[day]}요일 수업</h2>
      {staffItems.length === 0 && familyItems.length === 0 ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">수업이 없는 날이에요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {staffItems.map(({ cls, schedule }) => (
            <ScheduleRow key={`s-${cls.id}-${schedule.start_time}`} cls={cls} time={schedule} />
          ))}
          {familyItems.map(({ cls, schedule, who }) => (
            <ScheduleRow key={`f-${cls.id}-${schedule.start_time}`} cls={cls} time={schedule} who={who as string[]} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ScheduleRow({
  cls,
  time,
  who,
}: {
  cls: ClassInfo
  time: { start_time: string; end_time: string }
  who?: string[]
}) {
  return (
    <li>
      <Link
        to={`/classes/${cls.id}`}
        className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/60"
      >
        <div className="w-14 shrink-0 text-center tabular-nums">
          <p className="font-semibold">{formatTime(time.start_time)}</p>
          <p className="text-xs text-muted-foreground">{formatTime(time.end_time)}</p>
        </div>
        <div className="min-w-0 flex-1 border-l pl-3">
          <p className="truncate font-medium">{cls.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {cls.academy.name}
            {cls.room && ` · ${cls.room}`}
          </p>
        </div>
        {who && who.length > 0 && <Badge variant="secondary">{who.join(', ')}</Badge>}
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </li>
  )
}

/** 원장·강사: 학원별 반 목록 + 반 만들기·학생 명단 */
function StaffClassList({ data }: { data: MySchedule }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">반 관리</h2>
      {data.staffAcademies.map((academy) => {
        const classes = data.staffClasses.filter((c) => c.academy_id === academy.id)
        const active = classes.filter((c) => c.active)
        const archived = classes.length - active.length
        return (
          <Card key={academy.id} className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <h3 className="flex-1 truncate font-semibold">{academy.name}</h3>
              <Button asChild size="sm" variant="ghost">
                <Link to={`/academies/${academy.id}/students`}>
                  <UsersRound data-icon="inline-start" />
                  학생
                </Link>
              </Button>
              {academy.role === 'director' && (
                <Button asChild size="sm">
                  <Link to={`/academies/${academy.id}/classes/new`}>
                    <Plus data-icon="inline-start" />새 반
                  </Link>
                </Button>
              )}
            </div>
            {active.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                {academy.role === 'director' ? '반을 만들어 시간표와 수강생을 등록해 보세요.' : '아직 반이 없어요.'}
              </p>
            ) : (
              <ul className="divide-y">
                {active.map((c) => (
                  <li key={c.id}>
                    <Link to={`/classes/${c.id}`} className="flex items-center gap-2 px-4 py-3 hover:bg-muted/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground tabular-nums">{formatSchedules(c.schedules)}</p>
                      </div>
                      {c.subject && <Badge variant="secondary">{c.subject}</Badge>}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {archived > 0 && (
              <details className="border-t px-4 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">보관된 반 {archived}개</summary>
                <ul className="mt-1 flex flex-col gap-1">
                  {classes
                    .filter((c) => !c.active)
                    .map((c) => (
                      <li key={c.id}>
                        <Link to={`/classes/${c.id}`} className="underline-offset-4 hover:underline">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </Card>
        )
      })}
    </section>
  )
}
