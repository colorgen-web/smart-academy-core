import { supabase } from '@/lib/supabase'
import { formatTime, WEEKDAY_LABEL, WEEKDAY_ORDER } from '@/lib/date'

export type Schedule = { weekday: number; start_time: string; end_time: string }

export type ClassInfo = {
  id: number
  academy_id: number
  name: string
  subject: string | null
  room: string | null
  teacher_id: string | null
  active: boolean
  schedules: Schedule[]
  academy: { id: number; name: string }
}

export type Student = {
  id: number
  academy_id: number
  name: string
  grade: string | null
  school: string | null
  student_phone: string | null
  guardian_phones: string[]
  memo: string | null
  active: boolean
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export type AttendanceRecord = {
  class_id: number
  student_id: number
  date: string
  status: AttendanceStatus
  note: string | null
}

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '사유',
}

export const ATTENDANCE_ORDER: AttendanceStatus[] = ['present', 'late', 'absent', 'excused']

const CLASS_COLUMNS =
  'id, academy_id, name, subject, room, teacher_id, active, schedules:class_schedules(weekday, start_time, end_time), academy:academies(id, name)'
const STUDENT_COLUMNS = 'id, academy_id, name, grade, school, student_phone, guardian_phones, memo, active'

function db() {
  if (!supabase) throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  return supabase
}

function sortSchedules<T extends ClassInfo>(c: T): T {
  const rank = (w: number) => WEEKDAY_ORDER.indexOf(w as (typeof WEEKDAY_ORDER)[number])
  c.schedules = [...(c.schedules ?? [])].sort(
    (a, b) => rank(a.weekday) - rank(b.weekday) || a.start_time.localeCompare(b.start_time),
  )
  return c
}

/** 월·수 16:00–17:30, 금 15:00–16:00 처럼 같은 시간끼리 묶어서 표시 */
export function formatSchedules(schedules: Schedule[]) {
  if (schedules.length === 0) return '시간표 없음'
  const groups = new Map<string, number[]>()
  for (const s of schedules) {
    const key = `${formatTime(s.start_time)}–${formatTime(s.end_time)}`
    groups.set(key, [...(groups.get(key) ?? []), s.weekday])
  }
  return [...groups].map(([time, days]) => `${days.map((d) => WEEKDAY_LABEL[d]).join('·')} ${time}`).join(', ')
}

/** 볼 수 있는 반 (원장·강사: 학원 전체, 가족: 자녀 수강 반 — RLS 가 거른다) */
export async function fetchClasses(academyIds?: number[]): Promise<ClassInfo[]> {
  let query = db().from('classes').select(CLASS_COLUMNS).order('name')
  if (academyIds) {
    if (academyIds.length === 0) return []
    query = query.in('academy_id', academyIds)
  }
  const { data, error } = await query
  if (error) throw error
  return (data as unknown as ClassInfo[]).map(sortSchedules)
}

export async function fetchClass(id: number): Promise<ClassInfo | null> {
  const { data, error } = await db().from('classes').select(CLASS_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? sortSchedules(data as unknown as ClassInfo) : null
}

export async function saveClass(input: {
  id: number | null
  academyId: number
  name: string
  subject: string
  room: string
  teacherId: string | null
  schedules: { weekday: number; start: string; end: string }[]
}) {
  const { data, error } = await db().rpc('save_class', {
    p_id: input.id,
    p_academy_id: input.academyId,
    p_name: input.name,
    p_subject: input.subject,
    p_room: input.room,
    p_teacher_id: input.teacherId,
    p_schedules: input.schedules,
  })
  if (error) throw error
  return data as number
}

export async function setClassActive(id: number, active: boolean) {
  const { error } = await db().from('classes').update({ active }).eq('id', id)
  if (error) throw error
}

/** 학원 원장·강사 이름 (담당 강사 표시용) */
export async function fetchStaffNames(academyId: number) {
  const { data, error } = await db().rpc('academy_staff_names', { p_academy_id: academyId })
  if (error) throw error
  return (data as { user_id: string; name: string; role: 'director' | 'teacher' }[]) ?? []
}

// ── 학생 ──

export async function fetchStudents(academyId: number): Promise<Student[]> {
  const { data, error } = await db()
    .from('students')
    .select(STUDENT_COLUMNS)
    .eq('academy_id', academyId)
    .order('active', { ascending: false })
    .order('name')
  if (error) throw error
  return data as Student[]
}

export type StudentInput = Pick<Student, 'name' | 'grade' | 'school' | 'student_phone' | 'guardian_phones' | 'memo'>

export async function createStudent(academyId: number, input: StudentInput) {
  const { error } = await db().from('students').insert({ academy_id: academyId, ...input })
  if (error) throw error
}

export async function updateStudent(id: number, input: Partial<StudentInput> & { active?: boolean }) {
  const { error } = await db().from('students').update(input).eq('id', id)
  if (error) throw error
}

/** 가족(학부모·학생 계정)이 볼 수 있는 자녀/본인 */
export async function fetchMyStudents(): Promise<(Student & { academy: { name: string } })[]> {
  const { data: ids, error } = await db().rpc('my_student_ids')
  if (error) throw error
  const list = (ids as number[] | null) ?? []
  if (list.length === 0) return []
  const { data, error: e2 } = await db()
    .from('students')
    .select(`${STUDENT_COLUMNS}, academy:academies(name)`)
    .in('id', list)
    .order('name')
  if (e2) throw e2
  return data as unknown as (Student & { academy: { name: string } })[]
}

// ── 수강 ──

export async function fetchClassStudents(classId: number): Promise<Student[]> {
  const { data, error } = await db()
    .from('class_students')
    .select(`student:students(${STUDENT_COLUMNS})`)
    .eq('class_id', classId)
  if (error) throw error
  return (data as unknown as { student: Student }[])
    .map((r) => r.student)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

/** 학생들의 수강 반 id 목록 */
export async function fetchEnrollments(studentIds: number[]) {
  if (studentIds.length === 0) return []
  const { data, error } = await db().from('class_students').select('class_id, student_id').in('student_id', studentIds)
  if (error) throw error
  return data as { class_id: number; student_id: number }[]
}

export async function enrollStudents(classId: number, studentIds: number[]) {
  if (studentIds.length === 0) return
  const { error } = await db()
    .from('class_students')
    .insert(studentIds.map((student_id) => ({ class_id: classId, student_id })))
  if (error) throw error
}

export async function unenrollStudent(classId: number, studentId: number) {
  const { error } = await db().from('class_students').delete().eq('class_id', classId).eq('student_id', studentId)
  if (error) throw error
}

// ── 출석 ──

export async function fetchAttendance(filter: {
  classIds?: number[]
  studentIds?: number[]
  from: string
  to: string
}): Promise<AttendanceRecord[]> {
  let query = db()
    .from('attendance')
    .select('class_id, student_id, date, status, note')
    .gte('date', filter.from)
    .lte('date', filter.to)
    .order('date', { ascending: false })
  if (filter.classIds) {
    if (filter.classIds.length === 0) return []
    query = query.in('class_id', filter.classIds)
  }
  if (filter.studentIds) {
    if (filter.studentIds.length === 0) return []
    query = query.in('student_id', filter.studentIds)
  }
  const { data, error } = await query
  if (error) throw error
  return data as AttendanceRecord[]
}

export async function setAttendance(
  classId: number,
  studentId: number,
  date: string,
  status: AttendanceStatus | null,
  note?: string,
) {
  const { error } = await db().rpc('set_attendance', {
    p_class_id: classId,
    p_student_id: studentId,
    p_date: date,
    p_status: status,
    p_note: note ?? null,
  })
  if (error) throw error
}

/** 오늘(요일) 수업이 있는 반만, 시작 시간 순 */
export function classesOnWeekday(classes: ClassInfo[], weekday: number) {
  return classes
    .filter((c) => c.active)
    .flatMap((c) => c.schedules.filter((s) => s.weekday === weekday).map((s) => ({ cls: c, schedule: s })))
    .sort((a, b) => a.schedule.start_time.localeCompare(b.schedule.start_time))
}

export async function fetchClassesByIds(ids: number[]): Promise<ClassInfo[]> {
  if (ids.length === 0) return []
  const { data, error } = await db().from('classes').select(CLASS_COLUMNS).in('id', ids).order('name')
  if (error) throw error
  return (data as unknown as ClassInfo[]).map(sortSchedules)
}

/** 반별 재원 수강생 수 */
export async function fetchEnrollmentCounts(classIds: number[]) {
  const counts = new Map<number, number>()
  if (classIds.length === 0) return counts
  const { data, error } = await db()
    .from('class_students')
    .select('class_id, student:students(active)')
    .in('class_id', classIds)
  if (error) throw error
  for (const r of data as unknown as { class_id: number; student: { active: boolean } | null }[]) {
    if (r.student?.active) counts.set(r.class_id, (counts.get(r.class_id) ?? 0) + 1)
  }
  return counts
}
