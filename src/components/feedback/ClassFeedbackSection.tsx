import { Gauge, MessageSquareReply, MessageSquareText, PenLine } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { FeedbackAverage, FeedbackBars } from '@/components/feedback/FeedbackBars'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage } from '@/lib/academies'
import type { ClassInfo, Student } from '@/lib/classes'
import { addDays, formatDayLabel, todayKST } from '@/lib/date'
import {
  feedbackSummary,
  fetchLessonFeedback,
  fetchMyOwnStudentIds,
  latestRatableDate,
  RATING_LABEL,
  REPLY_MAX,
  setLessonFeedbackReply,
  type LessonFeedback,
} from '@/lib/feedback'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

const WEEKS = 8

/**
 * 반 화면의 수업 이해도.
 * 원장·강사: 수강생별 추이 + 최근 기록에 답변 달기 / 학부모: 자녀별 추이·코멘트 / 학생: 내 추이 + 남기기 버튼
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
  const { data, error, reload } = useAsync(
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

  if (isStaff)
    return <StaffView cls={cls} students={students} records={records} byStudent={byStudent} onSaved={reload} />

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
  cls,
  students,
  records,
  byStudent,
  onSaved,
}: {
  cls: ClassInfo
  students: Student[]
  records: LessonFeedback[]
  byStudent: (id: number) => LessonFeedback[]
  onSaved: () => void
}) {
  const name = new Map(students.map((s) => [s.id, s.name]))
  const recent = records.slice(0, 10)
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
      {recent.length > 0 && (
        <>
          <p className="border-t px-4 pt-3 pb-1 text-sm font-semibold">
            최근 기록 <span className="font-normal text-muted-foreground">· 눌러서 답변 달기</span>
          </p>
          <CommentList records={recent} name={name} replyClassId={cls.id} onSaved={onSaved} />
        </>
      )}
    </Card>
  )
}

/** 이해도 기록 목록. replyClassId 가 있으면(원장·강사) 기록마다 답변을 달 수 있다 */
function CommentList({
  records,
  name,
  replyClassId,
  onSaved,
}: {
  records: LessonFeedback[]
  name?: Map<number, string>
  replyClassId?: number
  onSaved?: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  if (records.length === 0) return null
  return (
    <ul className="divide-y border-t">
      {records.map((r) => {
        const key = `${r.student_id}-${r.date}`
        const canReply = replyClassId !== undefined
        return (
          <li key={key} className="flex flex-col gap-1 px-4 py-2.5 text-sm">
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
            {canReply && editing === key ? (
              <ReplyForm
                record={r}
                classId={replyClassId}
                onDone={(saved) => {
                  setEditing(null)
                  if (saved) onSaved?.()
                }}
              />
            ) : r.reply ? (
              <div className="mt-1 flex gap-1.5 rounded-lg bg-muted px-3 py-2">
                <MessageSquareReply className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-primary">선생님 답변</p>
                  <p className="break-words whitespace-pre-wrap text-foreground">{r.reply}</p>
                </div>
                {canReply && (
                  <button
                    type="button"
                    onClick={() => setEditing(key)}
                    className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    수정
                  </button>
                )}
              </div>
            ) : (
              canReply && (
                <button
                  type="button"
                  onClick={() => setEditing(key)}
                  className="mt-0.5 flex items-center gap-1.5 self-start text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  <MessageSquareReply className="size-3.5" />
                  답변 달기
                </button>
              )
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** 원장·강사: 이해도 기록에 답변 쓰기·고치기·지우기 */
function ReplyForm({
  record,
  classId,
  onDone,
}: {
  record: LessonFeedback
  classId: number
  onDone: (saved: boolean) => void
}) {
  const [text, setText] = useState(record.reply ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (value: string) => {
    setSaving(true)
    setError(null)
    try {
      await setLessonFeedbackReply(classId, record.student_id, record.date, value)
      onDone(true)
    } catch (err) {
      setError(errorMessage(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setSaving(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim() && text.trim() !== (record.reply ?? '') && !saving) save(text)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={REPLY_MAX}
        rows={2}
        autoFocus
        placeholder="학생과 학부모에게 보일 답변을 남겨 주세요"
        aria-label="답변"
        className={cn(inputClass, 'h-auto min-h-16 resize-y py-2.5')}
      />
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs text-muted-foreground tabular-nums">
          {text.length}/{REPLY_MAX}
        </span>
        {record.reply && (
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => save('')}>
            지우기
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onDone(false)}>
          취소
        </Button>
        <Button type="submit" size="sm" disabled={saving || !text.trim() || text.trim() === (record.reply ?? '')}>
          {saving ? '저장 중…' : '등록'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
