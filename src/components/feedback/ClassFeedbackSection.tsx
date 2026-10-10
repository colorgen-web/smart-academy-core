import { Gauge, MessageSquareText, PenLine } from 'lucide-react'
import { Link } from 'react-router'

import { FeedbackAverage, FeedbackBars } from '@/components/feedback/FeedbackBars'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import type { ClassInfo, Student } from '@/lib/classes'
import { addDays, formatDayLabel, todayKST } from '@/lib/date'
import {
  feedbackSummary,
  fetchLessonFeedback,
  fetchMyOwnStudentIds,
  latestRatableDate,
  RATING_LABEL,
  type LessonFeedback,
} from '@/lib/feedback'

const WEEKS = 8

/**
 * 반 화면의 수업 이해도.
 * 원장·강사: 수강생별 추이 + 최근 코멘트 / 학부모: 자녀별 추이·코멘트 / 학생: 내 추이 + 남기기 버튼
 */
export function ClassFeedbackSection({
  cls,
  students,
  isStaff,
}: {
  cls: ClassInfo
  /** 화면에 보이는 수강생 (가족은 자녀·본인만 보인다) */
  students: Student[]
  isStaff: boolean
}) {
  const today = todayKST()
  const { data, error } = useAsync(
    () =>
      Promise.all([
        fetchLessonFeedback({ classIds: [cls.id], from: addDays(today, -(WEEKS * 7 - 1)), to: today }),
        isStaff ? Promise.resolve([] as number[]) : fetchMyOwnStudentIds(),
      ]),
    [cls.id, today, isStaff],
  )
  // 아직 준비되지 않았거나(DB 적용 전) 불러오지 못하면 조용히 숨긴다
  if (error || !data) return null
  const [records, ownIds] = data
  const byStudent = (id: number) => records.filter((r) => r.student_id === id)

  if (isStaff) return <StaffView students={students} records={records} byStudent={byStudent} />

  return (
    <>
      {students.map((s) => (
        <FamilyCard
          key={s.id}
          cls={cls}
          student={s}
          records={byStudent(s.id)}
          isSelf={ownIds.includes(s.id)}
          today={today}
        />
      ))}
    </>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <Gauge className="size-4 text-primary" />
      <h3 className="flex-1 font-semibold">{title}</h3>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

function FamilyCard({
  cls,
  student,
  records,
  isSelf,
  today,
}: {
  cls: ClassInfo
  student: Student
  records: LessonFeedback[]
  isSelf: boolean
  today: string
}) {
  const summary = feedbackSummary(records)
  const rateDate = isSelf ? latestRatableDate(cls, today) : null
  const rated = rateDate ? records.find((r) => r.date === rateDate) : undefined

  return (
    <Card className="gap-0 py-0">
      <SectionTitle title={isSelf ? '내 수업 이해도' : `${student.name} 수업 이해도`} sub={`최근 ${WEEKS}주`} />
      <div className="flex flex-col gap-3 px-4 py-3">
        {records.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {isSelf ? '수업이 끝나면 이해도를 남겨 보세요.' : '아직 남긴 이해도가 없어요.'}
          </p>
        ) : (
          <>
            <FeedbackAverage average={summary.average} delta={summary.delta} />
            <FeedbackBars records={records} />
          </>
        )}
        {rateDate && (
          <Button asChild variant={rated ? 'outline' : 'default'}>
            <Link to={`/classes/${cls.id}/feedback?date=${rateDate}`}>
              <PenLine data-icon="inline-start" />
              {rated
                ? `${rateDate === today ? '오늘' : formatDayLabel(rateDate)} 이해도 수정`
                : `${rateDate === today ? '오늘' : formatDayLabel(rateDate)} 수업 이해도 남기기`}
            </Link>
          </Button>
        )}
      </div>
      <CommentList records={records.slice(0, 5)} />
    </Card>
  )
}

function StaffView({
  students,
  records,
  byStudent,
}: {
  students: Student[]
  records: LessonFeedback[]
  byStudent: (id: number) => LessonFeedback[]
}) {
  const name = new Map(students.map((s) => [s.id, s.name]))
  const commented = records.filter((r) => r.comment).slice(0, 10)
  const active = students.filter((s) => s.active)

  return (
    <Card className="gap-0 py-0">
      <SectionTitle title="수업 이해도" sub={`학생 자기 평가 · 최근 ${WEEKS}주`} />
      {active.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-muted-foreground">아직 수강생이 없어요.</p>
      ) : (
        <ul className="divide-y">
          {active.map((s) => {
            const mine = byStudent(s.id)
            const summary = feedbackSummary(mine)
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-16 shrink-0 truncate font-medium">{s.name}</span>
                <div className="min-w-0 flex-1">
                  {mine.length === 0 ? (
                    <span className="text-xs text-muted-foreground">기록 없음</span>
                  ) : (
                    <FeedbackBars records={mine} max={8} compact />
                  )}
                </div>
                <span className="w-16 shrink-0 text-right text-sm tabular-nums">
                  {summary.average === null ? (
                    '—'
                  ) : (
                    <>
                      <span className="font-semibold">{summary.average.toFixed(1)}</span>
                      {summary.delta !== null && Math.abs(summary.delta) >= 0.1 && (
                        <span className="ml-1 text-xs text-muted-foreground">{summary.delta > 0 ? '▲' : '▼'}</span>
                      )}
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {commented.length > 0 && (
        <>
          <p className="border-t px-4 pt-3 pb-1 text-sm font-semibold">최근 코멘트</p>
          <CommentList records={commented} name={name} />
        </>
      )}
    </Card>
  )
}

function CommentList({ records, name }: { records: LessonFeedback[]; name?: Map<number, string> }) {
  if (records.length === 0) return null
  return (
    <ul className="divide-y border-t">
      {records.map((r) => (
        <li key={`${r.student_id}-${r.date}`} className="flex flex-col gap-1 px-4 py-2.5 text-sm">
          <p className="flex items-center gap-2">
            <span className="tabular-nums text-muted-foreground">{formatDayLabel(r.date)}</span>
            {name && <span className="font-medium">{name.get(r.student_id) ?? '학생'}</span>}
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {r.rating} · {RATING_LABEL[r.rating]}
            </span>
          </p>
          {r.comment && (
            <p className="flex gap-1.5 text-foreground">
              <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="break-words">{r.comment}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
