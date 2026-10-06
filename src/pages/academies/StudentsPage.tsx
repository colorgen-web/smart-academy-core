import { Pencil, Plus, UserRoundCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'

import { Field } from '@/components/Field'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage, fetchAcademy, fetchMyMembership } from '@/lib/academies'
import { createStudent, fetchStudents, updateStudent, type Student, type StudentInput } from '@/lib/classes'
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/profile'
import { inputClass } from '@/lib/styles'

/** 학원 학생 명단: 원장은 등록·수정·퇴원 처리, 강사는 보기만 */
export function StudentsPage({ userId }: { userId: string }) {
  const academyId = Number(useParams().id)
  const meta = useAsync(async () => {
    const [academy, membership] = await Promise.all([fetchAcademy(academyId), fetchMyMembership(academyId, userId)])
    return { academy, membership }
  }, [academyId, userId])
  const list = useAsync(() => fetchStudents(academyId), [academyId])
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const isDirector = meta.data?.membership?.role === 'director' && meta.data.membership.status === 'approved'
  const students = list.data ?? []
  const visible = students.filter((s) => s.active || showInactive)
  const inactiveCount = students.filter((s) => !s.active).length

  const toggleActive = async (s: Student) => {
    const msg = s.active
      ? `${s.name} 학생을 퇴원 처리할까요? 학부모 화면에서 보이지 않게 되고, 출석 기록은 남아요.`
      : `${s.name} 학생을 다시 등록할까요?`
    if (!window.confirm(msg)) return
    try {
      await updateStudent(s.id, { active: !s.active })
      list.reload()
    } catch (err) {
      window.alert(errorMessage(err, '바꾸지 못했어요.'))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="학생 명단"
        backTo={`/academies/${academyId}`}
        action={
          isDirector &&
          editing !== 'new' && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus data-icon="inline-start" />
              학생 등록
            </Button>
          )
        }
      />
      {meta.data?.academy && <p className="-mt-2 text-sm text-muted-foreground">{meta.data.academy.name}</p>}

      {editing === 'new' && (
        <StudentForm
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            await createStudent(academyId, input)
            setEditing(null)
            list.reload()
          }}
        />
      )}

      {isDirector && (
        <p className="rounded-xl bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">학부모 연락처</b>를 넣으면, 그 번호로 가입한 뒤 이 학원에 학부모로 승인된 회원이 자녀의
          반·출석을 볼 수 있어요. 학생 본인 계정은 <b className="text-foreground">학생 연락처</b>로 연결돼요.
        </p>
      )}

      {list.loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : list.error ? (
        <p className="py-10 text-center text-sm text-destructive">학생 명단을 불러오지 못했어요.</p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">등록된 학생이 없어요.</p>
      ) : (
        <Card className="gap-0 py-0">
          <p className="border-b px-4 py-2.5 text-sm text-muted-foreground">
            재원 <span className="font-semibold text-foreground tabular-nums">{students.length - inactiveCount}</span>명
          </p>
          <ul className="divide-y">
            {visible.map((s) =>
              editing === s.id ? (
                <li key={s.id} className="p-3">
                  <StudentForm
                    student={s}
                    onCancel={() => setEditing(null)}
                    onSave={async (input) => {
                      await updateStudent(s.id, input)
                      setEditing(null)
                      list.reload()
                    }}
                  />
                </li>
              ) : (
                <li key={s.id} className="flex items-start gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{s.name}</span>
                      {s.grade && <span className="text-sm text-muted-foreground">{s.grade}</span>}
                      {s.school && <span className="text-sm text-muted-foreground">· {s.school}</span>}
                      {!s.active && <Badge variant="outline">퇴원</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {s.guardian_phones.length > 0
                        ? `학부모 ${s.guardian_phones.map(formatPhone).join(', ')}`
                        : '학부모 연락처 없음'}
                      {s.student_phone && ` · 학생 ${formatPhone(s.student_phone)}`}
                    </p>
                    {s.memo && <p className="mt-0.5 text-xs text-muted-foreground">{s.memo}</p>}
                  </div>
                  {isDirector && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s.id)} aria-label={`${s.name} 수정`}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleActive(s)}
                        aria-label={s.active ? `${s.name} 퇴원 처리` : `${s.name} 다시 등록`}
                        title={s.active ? '퇴원 처리' : '다시 등록'}
                      >
                        <UserRoundCheck />
                      </Button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        </Card>
      )}

      {inactiveCount > 0 && (
        <button
          type="button"
          onClick={() => setShowInactive((v) => !v)}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {showInactive ? '퇴원생 숨기기' : `퇴원생 ${inactiveCount}명 보기`}
        </button>
      )}
    </div>
  )
}

function StudentForm({
  student,
  onSave,
  onCancel,
}: {
  student?: Student
  onSave: (input: StudentInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(student?.name ?? '')
  const [grade, setGrade] = useState(student?.grade ?? '')
  const [school, setSchool] = useState(student?.school ?? '')
  const [guardian1, setGuardian1] = useState(student?.guardian_phones[0] ?? '')
  const [guardian2, setGuardian2] = useState(student?.guardian_phones[1] ?? '')
  const [studentPhone, setStudentPhone] = useState(student?.student_phone ?? '')
  const [memo, setMemo] = useState(student?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phones = [guardian1, guardian2, studentPhone].map(normalizePhone)
  const invalid = phones.map((p) => p.length > 0 && !isValidPhone(p))
  const canSave = name.trim().length > 0 && !invalid.some(Boolean) && !saving

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        grade: grade.trim() || null,
        school: school.trim() || null,
        guardian_phones: [...new Set([phones[0], phones[1]].filter(Boolean))],
        student_phone: phones[2] || null,
        memo: memo.trim() || null,
      })
    } catch (err) {
      setError(errorMessage(err, '저장하지 못했어요. 입력한 내용을 확인해 주세요.'))
      setSaving(false)
    }
  }

  const phoneInput = (value: string, set: (v: string) => void, bad: boolean, label: string) => (
    <input
      value={formatPhone(value)}
      onChange={(e) => set(normalizePhone(e.target.value))}
      inputMode="numeric"
      placeholder="010-0000-0000"
      aria-label={label}
      aria-invalid={bad || undefined}
      className={inputClass}
    />
  )

  return (
    <Card size="sm" className="ring-primary/40">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <Field label="이름">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className={inputClass} autoFocus />
            </Field>
            <Field label="학년">
              <input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} placeholder="초4" className={inputClass} />
            </Field>
          </div>
          <Field label="학교 (선택)">
            <input value={school} onChange={(e) => setSchool(e.target.value)} maxLength={40} className={inputClass} />
          </Field>
          <Field label="학부모 연락처">
            <div className="flex flex-col gap-2">
              {phoneInput(guardian1, setGuardian1, invalid[0], '학부모 연락처 1')}
              {phoneInput(guardian2, setGuardian2, invalid[1], '학부모 연락처 2')}
            </div>
          </Field>
          <Field label="학생 연락처 (선택)">{phoneInput(studentPhone, setStudentPhone, invalid[2], '학생 연락처')}</Field>
          <Field label="메모 (선택)">
            <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200} className={inputClass} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              취소
            </Button>
            <Button type="submit" disabled={!canSave}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
