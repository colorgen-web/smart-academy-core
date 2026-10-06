import { CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage } from '@/lib/academies'
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_ORDER,
  fetchAttendance,
  fetchClass,
  fetchClassStudents,
  setAttendance,
  type AttendanceStatus,
} from '@/lib/classes'
import { addDays, formatDayLabel, formatTime, isValidDate, todayKST, weekdayOf } from '@/lib/date'
import { ATTENDANCE_TONE } from '@/components/classes/attendanceTone'
import { cn } from '@/lib/utils'

/** 원장·강사: 날짜별 출석 체크. 누르면 바로 저장, 같은 버튼을 다시 누르면 지운다 */
export function AttendanceCheckPage() {
  const id = Number(useParams().id)
  const [params, setParams] = useSearchParams()
  const today = todayKST()
  const raw = params.get('date')
  const date = isValidDate(raw) && raw <= today ? raw : today

  const data = useAsync(async () => {
    const [cls, students, records] = await Promise.all([
      fetchClass(id),
      fetchClassStudents(id),
      fetchAttendance({ classIds: [id], from: date, to: date }),
    ])
    return { cls, students, records }
  }, [id, date])

  // 화면에서 바로 바뀌도록 로컬 상태로 덮어쓴다 (날짜가 바뀌면 초기화)
  const [overrides, setOverrides] = useState<{ date: string; map: Map<number, AttendanceStatus | null> }>({
    date,
    map: new Map(),
  })
  const local = overrides.date === date ? overrides.map : new Map<number, AttendanceStatus | null>()
  const [error, setError] = useState<string | null>(null)

  const goDate = (next: string) => setParams(next === today ? {} : { date: next }, { replace: true })

  if (data.loading) return <PageHeader title="출석 체크" backTo={`/classes/${id}`} />
  if (data.error || !data.data?.cls) {
    return (
      <div>
        <PageHeader title="출석 체크" backTo={`/classes/${id}`} />
        <p className="py-10 text-center text-sm text-muted-foreground">출석부를 불러오지 못했어요.</p>
      </div>
    )
  }

  const { cls, students, records } = data.data
  const saved = new Map(records.map((r) => [r.student_id, r.status]))
  const statusOf = (studentId: number) => (local.has(studentId) ? local.get(studentId)! : (saved.get(studentId) ?? null))
  // 퇴원한 학생은 그날 기록이 있을 때만 보여준다
  const rows = students.filter((s) => s.active || saved.has(s.id))
  const todaySchedule = cls.schedules.filter((s) => s.weekday === weekdayOf(date))

  const apply = async (studentId: number, status: AttendanceStatus | null) => {
    const prev = statusOf(studentId)
    setError(null)
    setOverrides((o) => ({ date, map: new Map(o.date === date ? o.map : []).set(studentId, status) }))
    try {
      await setAttendance(cls.id, studentId, date, status)
    } catch (err) {
      setOverrides((o) => ({ date, map: new Map(o.map).set(studentId, prev) }))
      setError(errorMessage(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'))
    }
  }

  const unchecked = rows.filter((s) => statusOf(s.id) === null)
  const markAllPresent = async () => {
    for (const s of unchecked) await apply(s.id, 'present')
  }

  const counts = ATTENDANCE_ORDER.map((st) => ({ st, n: rows.filter((s) => statusOf(s.id) === st).length }))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="출석 체크" backTo={`/classes/${cls.id}`} />

      <div>
        <p className="text-xs text-muted-foreground">{cls.academy.name}</p>
        <h2 className="text-lg font-semibold">{cls.name}</h2>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => goDate(addDays(date, -1))} aria-label="전날">
          <ChevronLeft />
        </Button>
        <div className="flex-1 text-center">
          <p className="font-semibold tabular-nums">{formatDayLabel(date)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {todaySchedule.length > 0
              ? todaySchedule.map((s) => `${formatTime(s.start_time)}–${formatTime(s.end_time)}`).join(', ')
              : '시간표에 없는 날'}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => goDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="다음 날"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {counts.map(({ st, n }) => (
          <div key={st} className="rounded-xl bg-card px-2 py-2 ring-1 ring-foreground/10">
            <p className="text-xs text-muted-foreground">{ATTENDANCE_LABEL[st]}</p>
            <p className="text-lg font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          수강생이 없어요.{' '}
          <Link to={`/classes/${cls.id}`} className="text-primary underline underline-offset-4">
            반 정보
          </Link>
          에서 학생을 추가해 주세요.
        </p>
      ) : (
        <>
          {unchecked.length > 0 && (
            <Button variant="outline" onClick={markAllPresent}>
              <CheckCheck data-icon="inline-start" />
              남은 {unchecked.length}명 모두 출석
            </Button>
          )}
          <Card className="gap-0 py-0">
            <ul className="divide-y">
              {rows.map((s) => {
                const current = statusOf(s.id)
                return (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      {s.grade && <p className="text-xs text-muted-foreground">{s.grade}</p>}
                    </div>
                    <div role="radiogroup" aria-label={`${s.name} 출석`} className="flex gap-1">
                      {ATTENDANCE_ORDER.map((st) => (
                        <button
                          key={st}
                          type="button"
                          role="radio"
                          aria-checked={current === st}
                          onClick={() => apply(s.id, current === st ? null : st)}
                          className={cn(
                            'h-9 w-11 rounded-lg text-sm font-medium transition-colors',
                            current === st ? ATTENDANCE_TONE[st] : 'bg-muted text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {ATTENDANCE_LABEL[st]}
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
