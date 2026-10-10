import { Archive, ClipboardCheck, Clock, DoorOpen, Pencil, Plus, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { ClassFeedbackSection } from '@/components/feedback/ClassFeedbackSection'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage, fetchMyMembership } from '@/lib/academies'
import {
  enrollStudents,
  fetchClass,
  fetchClassStudents,
  fetchStaffNames,
  fetchStudents,
  setClassActive,
  unenrollStudent,
  type Student,
} from '@/lib/classes'
import { formatTime, WEEKDAY_LABEL } from '@/lib/date'

export function ClassDetailPage({ userId }: { userId: string }) {
  const id = Number(useParams().id)
  const info = useAsync(async () => {
    const cls = Number.isInteger(id) ? await fetchClass(id) : null
    if (!cls) return null
    const [membership, staff] = await Promise.all([
      fetchMyMembership(cls.academy_id, userId),
      fetchStaffNames(cls.academy_id),
    ])
    return { cls, membership, staff }
  }, [id, userId])
  const students = useAsync(() => (Number.isInteger(id) ? fetchClassStudents(id) : Promise.resolve([])), [id])
  const [adding, setAdding] = useState(false)

  if (info.loading) return <PageHeader title="반" backTo="/classes" />
  if (info.error || !info.data) {
    return (
      <div>
        <PageHeader title="반" backTo="/classes" />
        <p className="py-10 text-center text-sm text-muted-foreground">
          {info.error ? '반 정보를 불러오지 못했어요.' : '볼 수 없는 반이에요.'}
        </p>
      </div>
    )
  }

  const { cls, membership, staff } = info.data
  const role = membership?.status === 'approved' ? membership.role : null
  const isDirector = role === 'director'
  const isStaff = role === 'director' || role === 'teacher'
  const teacher = staff.find((s) => s.user_id === cls.teacher_id)

  const toggleActive = async () => {
    const msg = cls.active
      ? '이 반을 보관할까요? 수업 목록에서 빠지지만 출석 기록은 남아요.'
      : '이 반을 다시 운영할까요?'
    if (!window.confirm(msg)) return
    try {
      await setClassActive(cls.id, !cls.active)
      info.reload()
    } catch (err) {
      window.alert(errorMessage(err, '바꾸지 못했어요.'))
    }
  }

  const remove = async (s: Student) => {
    if (!window.confirm(`${s.name} 학생을 이 반에서 뺄까요? 지난 출석 기록은 남아요.`)) return
    try {
      await unenrollStudent(cls.id, s.id)
      students.reload()
    } catch (err) {
      window.alert(errorMessage(err, '빼지 못했어요.'))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="반"
        backTo="/classes"
        action={
          isDirector && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/classes/${cls.id}/edit`}>
                <Pencil data-icon="inline-start" />
                수정
              </Link>
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{cls.academy.name}</p>
              <h2 className="text-lg font-semibold leading-snug">{cls.name}</h2>
            </div>
            {cls.subject && <Badge variant="secondary">{cls.subject}</Badge>}
            {!cls.active && <Badge variant="outline">보관됨</Badge>}
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-start gap-2">
              <dt>
                <Clock className="size-4 text-muted-foreground" aria-label="시간표" />
              </dt>
              <dd className="flex flex-col gap-0.5">
                {cls.schedules.length === 0
                  ? '시간표 없음'
                  : cls.schedules.map((s) => (
                      <span key={`${s.weekday}-${s.start_time}`} className="tabular-nums">
                        {WEEKDAY_LABEL[s.weekday]} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                      </span>
                    ))}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt>
                <UserRound className="size-4 text-muted-foreground" aria-label="담당" />
              </dt>
              <dd>{teacher ? `${teacher.name} ${teacher.role === 'director' ? '원장' : '선생님'}` : '담당 미정'}</dd>
            </div>
            {cls.room && (
              <div className="flex items-center gap-2">
                <dt>
                  <DoorOpen className="size-4 text-muted-foreground" aria-label="강의실" />
                </dt>
                <dd>{cls.room}</dd>
              </div>
            )}
          </dl>
          {isStaff && cls.active && (
            <Button asChild className="mt-1">
              <Link to={`/classes/${cls.id}/attendance`}>
                <ClipboardCheck data-icon="inline-start" />
                출석 체크
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {students.data && <ClassFeedbackSection cls={cls} students={students.data} isStaff={isStaff} />}

      {isStaff && (
        <Card className="gap-0 py-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <h3 className="flex-1 font-semibold">수강생 {students.data?.length ?? 0}명</h3>
            {isDirector && !adding && (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus data-icon="inline-start" />
                추가
              </Button>
            )}
          </div>
          {adding && (
            <AddStudents
              academyId={cls.academy_id}
              classId={cls.id}
              enrolled={new Set(students.data?.map((s) => s.id))}
              onDone={() => {
                setAdding(false)
                students.reload()
              }}
            />
          )}
          {students.loading ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">불러오는 중…</p>
          ) : !students.data || students.data.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">아직 수강생이 없어요.</p>
          ) : (
            <ul className="divide-y">
              {students.data.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="font-medium">{s.name}</span>
                  {s.grade && <span className="text-sm text-muted-foreground">{s.grade}</span>}
                  {!s.active && <Badge variant="outline">퇴원</Badge>}
                  <span className="flex-1" />
                  {isDirector && (
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(s)} aria-label={`${s.name} 빼기`}>
                      <X />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {isDirector && (
        <Button variant="ghost" className="text-muted-foreground" onClick={toggleActive}>
          <Archive data-icon="inline-start" />
          {cls.active ? '반 보관하기' : '반 다시 운영하기'}
        </Button>
      )}
    </div>
  )
}

/** 원장: 학원 학생 명단에서 골라 반에 넣기 */
function AddStudents({
  academyId,
  classId,
  enrolled,
  onDone,
}: {
  academyId: number
  classId: number
  enrolled: Set<number>
  onDone: () => void
}) {
  const { data, loading } = useAsync(() => fetchStudents(academyId), [academyId])
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const candidates = (data ?? []).filter((s) => s.active && !enrolled.has(s.id))

  const save = async () => {
    setSaving(true)
    try {
      await enrollStudents(classId, [...picked])
      onDone()
    } catch (err) {
      window.alert(errorMessage(err, '추가하지 못했어요.'))
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b bg-muted/50 px-4 py-3">
      {loading ? (
        <p className="text-sm text-muted-foreground">학생 명단을 불러오는 중…</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          넣을 수 있는 학생이 없어요.{' '}
          <Link to={`/academies/${academyId}/students`} className="text-primary underline underline-offset-4">
            학생 명단
          </Link>
          에서 먼저 등록해 주세요.
        </p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
          {candidates.map((s) => (
            <li key={s.id}>
              <label className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={picked.has(s.id)}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(s.id)
                      else next.delete(s.id)
                      return next
                    })
                  }
                />
                <span className="font-medium">{s.name}</span>
                {s.grade && <span className="text-muted-foreground">{s.grade}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          닫기
        </Button>
        <Button size="sm" onClick={save} disabled={saving || picked.size === 0}>
          {picked.size > 0 ? `${picked.size}명 추가` : '추가'}
        </Button>
      </div>
    </div>
  )
}
