import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Field } from '@/components/Field'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage } from '@/lib/academies'
import { fetchClass, fetchStaffNames, saveClass, type ClassInfo } from '@/lib/classes'
import { formatTime, WEEKDAY_LABEL, WEEKDAY_ORDER } from '@/lib/date'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

type Slot = { key: number; weekdays: number[]; start: string; end: string }

let slotKey = 0
const newSlot = (weekdays: number[] = [], start = '16:00', end = '17:00'): Slot => ({
  key: ++slotKey,
  weekdays,
  start,
  end,
})

/** 같은 시간대의 요일을 한 줄로 묶어서 편집한다 */
function toSlots(cls: ClassInfo | null): Slot[] {
  if (!cls || cls.schedules.length === 0) return [newSlot()]
  const groups = new Map<string, Slot>()
  for (const s of cls.schedules) {
    const key = `${s.start_time}-${s.end_time}`
    const slot = groups.get(key) ?? newSlot([], formatTime(s.start_time), formatTime(s.end_time))
    slot.weekdays.push(s.weekday)
    groups.set(key, slot)
  }
  return [...groups.values()]
}

/** 원장: 반 만들기 (/academies/:academyId/classes/new) · 수정 (/classes/:id/edit) */
export function ClassFormPage() {
  const params = useParams()
  const editId = params.id ? Number(params.id) : null
  const { data, error, loading } = useAsync(async () => {
    const cls = editId ? await fetchClass(editId) : null
    const academyId = cls?.academy_id ?? Number(params.academyId)
    const staff = await fetchStaffNames(academyId)
    return { cls, academyId, staff }
  }, [editId, params.academyId])

  if (loading) return <PageHeader title={editId ? '반 수정' : '반 만들기'} backTo="/classes" />
  if (error || !data || (editId && !data.cls)) {
    return (
      <div>
        <PageHeader title="반" backTo="/classes" />
        <p className="py-10 text-center text-sm text-muted-foreground">반 정보를 불러오지 못했어요.</p>
      </div>
    )
  }
  return <ClassForm key={data.cls?.id ?? 'new'} {...data} />
}

function ClassForm({
  cls,
  academyId,
  staff,
}: {
  cls: ClassInfo | null
  academyId: number
  staff: { user_id: string; name: string; role: string }[]
}) {
  const navigate = useNavigate()
  const [name, setName] = useState(cls?.name ?? '')
  const [subject, setSubject] = useState(cls?.subject ?? '')
  const [room, setRoom] = useState(cls?.room ?? '')
  const [teacherId, setTeacherId] = useState(cls?.teacher_id ?? '')
  const [slots, setSlots] = useState<Slot[]>(() => toSlots(cls))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateSlot = (key: number, patch: Partial<Slot>) =>
    setSlots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  const toggleDay = (slot: Slot, day: number) =>
    updateSlot(slot.key, {
      weekdays: slot.weekdays.includes(day) ? slot.weekdays.filter((d) => d !== day) : [...slot.weekdays, day],
    })

  const filled = slots.filter((s) => s.weekdays.length > 0)
  const badTime = filled.some((s) => !s.start || !s.end || s.end <= s.start)
  const schedules = filled.flatMap((s) => s.weekdays.map((weekday) => ({ weekday, start: s.start, end: s.end })))
  const duplicate = new Set(schedules.map((s) => `${s.weekday}-${s.start}`)).size !== schedules.length

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || badTime || duplicate) return
    setSaving(true)
    setError(null)
    try {
      const id = await saveClass({
        id: cls?.id ?? null,
        academyId,
        name: name.trim(),
        subject,
        room,
        teacherId: teacherId || null,
        schedules,
      })
      navigate(`/classes/${id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, '저장하지 못했어요. 입력한 내용을 확인해 주세요.'))
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={cls ? '반 수정' : '반 만들기'} backTo={cls ? `/classes/${cls.id}` : `/academies/${academyId}`} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Field label="반 이름">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="초등 사고력 수학 A반"
                className={inputClass}
                autoFocus={!cls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="과목 (선택)">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={30} placeholder="수학" className={inputClass} />
              </Field>
              <Field label="강의실 (선택)">
                <input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={30} placeholder="201호" className={inputClass} />
              </Field>
            </div>
            <Field label="담당 강사">
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={inputClass}>
                <option value="">미정</option>
                {staff.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.name} ({s.role === 'director' ? '원장' : '강사'})
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold">시간표</h2>
              <p className="text-xs text-muted-foreground">같은 시간에 하는 요일을 함께 고르세요. 시간이 다른 요일은 줄을 추가해요.</p>
            </div>
            {slots.map((slot) => (
              <div key={slot.key} className="flex flex-col gap-2 rounded-xl border p-3">
                <div className="grid grid-cols-7 gap-1" role="group" aria-label="요일">
                  {WEEKDAY_ORDER.map((day) => {
                    const on = slot.weekdays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(slot, day)}
                        className={cn(
                          'h-9 rounded-lg text-sm font-medium transition-colors',
                          on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {WEEKDAY_LABEL[day]}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.start}
                    onChange={(e) => updateSlot(slot.key, { start: e.target.value })}
                    aria-label="시작 시간"
                    className={cn(inputClass, 'h-10 flex-1')}
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={(e) => updateSlot(slot.key, { end: e.target.value })}
                    aria-label="끝 시간"
                    aria-invalid={slot.end <= slot.start || undefined}
                    className={cn(inputClass, 'h-10 flex-1')}
                  />
                  {slots.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSlots((list) => list.filter((s) => s.key !== slot.key))}
                      aria-label="이 시간 삭제"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setSlots((list) => [...list, newSlot()])}>
              <Plus data-icon="inline-start" />
              다른 시간 추가
            </Button>
            {badTime && <p className="text-sm text-destructive">끝 시간은 시작 시간보다 늦어야 해요.</p>}
            {duplicate && <p className="text-sm text-destructive">같은 요일·시작 시간이 두 번 들어갔어요.</p>}
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11" disabled={saving || !name.trim() || badTime || duplicate}>
          {saving ? '저장 중…' : cls ? '저장' : '반 만들기'}
        </Button>
      </form>
    </div>
  )
}
