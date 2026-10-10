import { CheckCircle2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage } from '@/lib/academies'
import { fetchAttendance, fetchClass, fetchClassStudents, type ClassInfo } from '@/lib/classes'
import { addDays, formatDayLabel, isValidDate, todayKST } from '@/lib/date'
import {
  canRateDate,
  FEEDBACK_DAYS,
  fetchLessonFeedback,
  fetchMyOwnStudentIds,
  latestRatableDate,
  RATING_LABEL,
  RATINGS,
  setLessonFeedback,
  type LessonFeedback,
  type Rating,
} from '@/lib/feedback'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

/** 학생: 수업 이해도 남기기 (최근 7일 안의 수업) */
export function LessonFeedbackPage() {
  const id = Number(useParams().id)
  const [params, setParams] = useSearchParams()
  const today = todayKST()

  const base = useAsync(async () => {
    const [cls, students, ownIds] = await Promise.all([fetchClass(id), fetchClassStudents(id), fetchMyOwnStudentIds()])
    const me = students.find((s) => ownIds.includes(s.id)) ?? null
    return { cls, me }
  }, [id])

  const cls = base.data?.cls ?? null
  const me = base.data?.me ?? null
  const raw = params.get('date')
  const date = cls && isValidDate(raw) && canRateDate(cls, raw, today) ? raw : cls ? latestRatableDate(cls, today) : null

  const day = useAsync(async () => {
    if (!me || !date) return null
    const [feedback, attendance] = await Promise.all([
      fetchLessonFeedback({ classIds: [id], studentIds: [me.id], from: date, to: date }),
      fetchAttendance({ classIds: [id], studentIds: [me.id], from: date, to: date }),
    ])
    return { feedback: feedback[0] ?? null, attendance: attendance[0] ?? null }
  }, [id, me?.id, date])

  const header = <PageHeader title="수업 이해도" backTo={`/classes/${id}`} />
  if (base.loading) return header
  if (base.error || !cls || !me) {
    return (
      <div>
        {header}
        <p className="py-10 text-center text-sm text-muted-foreground">
          {base.error ? '수업 정보를 불러오지 못했어요.' : '이 수업을 듣는 학생 본인만 이해도를 남길 수 있어요.'}
        </p>
      </div>
    )
  }
  if (!date) {
    return (
      <div>
        {header}
        <p className="py-10 text-center text-sm text-muted-foreground">
          최근 {FEEDBACK_DAYS}일 안에 이해도를 남길 수 있는 수업이 없어요.
        </p>
      </div>
    )
  }

  const dates = ratableDates(cls, today)

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div>
        <p className="text-xs text-muted-foreground">{cls.academy.name}</p>
        <h2 className="text-lg font-semibold">{cls.name}</h2>
      </div>

      {dates.length > 1 && (
        <div role="tablist" aria-label="수업 날짜" className="flex gap-1.5 overflow-x-auto">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === date}
              onClick={() => setParams({ date: d }, { replace: true })}
              className={cn(
                'h-9 shrink-0 rounded-full px-3 text-sm font-medium tabular-nums transition-colors',
                d === date ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground ring-1 ring-foreground/10',
              )}
            >
              {d === today ? '오늘' : formatDayLabel(d)}
            </button>
          ))}
        </div>
      )}

      {day.loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : day.error || !day.data ? (
        <p className="py-6 text-center text-sm text-destructive">불러오지 못했어요.</p>
      ) : day.data.attendance && ['absent', 'excused'].includes(day.data.attendance.status) ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          {formatDayLabel(date)} 수업은 결석으로 기록돼 있어 이해도를 남길 수 없어요.
        </p>
      ) : (
        <FeedbackForm
          key={`${date}-${day.data.feedback?.updated_at ?? 'new'}`}
          classId={cls.id}
          studentId={me.id}
          date={date}
          existing={day.data.feedback}
        />
      )}
    </div>
  )
}

function ratableDates(cls: ClassInfo, today: string) {
  const list: string[] = []
  for (let i = 0; i < FEEDBACK_DAYS; i++) {
    const d = addDays(today, -i)
    if (canRateDate(cls, d, today)) list.push(d)
  }
  return list
}

function FeedbackForm({
  classId,
  studentId,
  date,
  existing,
}: {
  classId: number
  studentId: number
  date: string
  existing: LessonFeedback | null
}) {
  const navigate = useNavigate()
  const [rating, setRating] = useState<Rating | null>(existing?.rating ?? null)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changed = rating !== (existing?.rating ?? null) || comment.trim() !== (existing?.comment ?? '')

  const save = async (next: Rating | null) => {
    setSaving(true)
    setError(null)
    try {
      await setLessonFeedback(classId, studentId, date, next, comment)
      navigate(`/classes/${classId}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setSaving(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (rating && changed && !saving) save(rating)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="font-semibold">
            {formatDayLabel(date)} 수업, 얼마나 이해했나요?
            {existing && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-success">
                <CheckCircle2 className="size-3.5" />
                남김
              </span>
            )}
          </h3>
          <div role="radiogroup" aria-label="이해도" className="flex flex-col gap-1.5">
            {RATINGS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={rating === r}
                onClick={() => setRating(r)}
                className={cn(
                  'flex h-12 items-center gap-3 rounded-xl px-3 text-left text-[15px] ring-1 transition-colors',
                  rating === r
                    ? 'bg-primary/10 font-semibold ring-2 ring-primary'
                    : 'bg-card ring-foreground/10 hover:bg-muted/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                    rating === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {r}
                </span>
                {RATING_LABEL[r]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1.5">
          <label htmlFor="feedback-comment" className="text-sm font-medium">
            코멘트 <span className="font-normal text-muted-foreground">(선택)</span>
          </label>
          <textarea
            id="feedback-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="어려웠던 부분이나 선생님께 하고 싶은 말"
            className={cn(inputClass, 'h-auto resize-none py-2')}
          />
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>선생님과 학부모님이 볼 수 있어요.</span>
            <span className="tabular-nums">{comment.length}/200</span>
          </p>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11" disabled={!rating || !changed || saving}>
        {saving ? '저장 중…' : existing ? '수정하기' : '남기기'}
      </Button>
      {!existing && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">처음 남기면 학부모님께 알림이 가요.</p>
      )}
      {existing && (
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          disabled={saving}
          onClick={() => window.confirm('남긴 이해도를 지울까요?') && save(null)}
        >
          <Trash2 data-icon="inline-start" />
          지우기
        </Button>
      )}
    </form>
  )
}
