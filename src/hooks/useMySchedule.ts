import { useAsync } from '@/hooks/useAsync'
import { fetchMyAcademies, type AcademyRole } from '@/lib/academies'
import {
  fetchClasses,
  fetchClassesByIds,
  fetchEnrollments,
  fetchMyStudents,
  type ClassInfo,
  type Student,
} from '@/lib/classes'

export type StaffAcademy = { id: number; name: string; role: AcademyRole }
export type Child = Student & { academy: { name: string } }

export type MySchedule = {
  /** 원장·강사로 승인된 학원 */
  staffAcademies: StaffAcademy[]
  /** 그 학원들의 반 */
  staffClasses: ClassInfo[]
  /** 학부모·학생으로 연결된 자녀(또는 본인) */
  children: Child[]
  /** 자녀가 듣는 반 + 그 반을 듣는 자녀 id */
  childClasses: { cls: ClassInfo; studentIds: number[] }[]
}

async function loadMySchedule(userId: string): Promise<MySchedule> {
  const mine = await fetchMyAcademies(userId)
  const approved = mine.filter((m) => m.status === 'approved' && m.academy.status === 'approved')
  const staffAcademies = approved
    .filter((m) => m.role === 'director' || m.role === 'teacher')
    .map((m) => ({ id: m.academy.id, name: m.academy.name, role: m.role }))
  const isFamily = approved.some((m) => m.role === 'parent' || m.role === 'student')

  const [staffClasses, children] = await Promise.all([
    fetchClasses(staffAcademies.map((a) => a.id)),
    isFamily ? fetchMyStudents() : Promise.resolve([] as Child[]),
  ])

  const enrollments = await fetchEnrollments(children.map((c) => c.id))
  const byClass = new Map<number, number[]>()
  for (const e of enrollments) byClass.set(e.class_id, [...(byClass.get(e.class_id) ?? []), e.student_id])
  const familyClasses = await fetchClassesByIds([...byClass.keys()])

  return {
    staffAcademies,
    staffClasses,
    children,
    childClasses: familyClasses
      .filter((c) => c.active)
      .map((cls) => ({ cls, studentIds: byClass.get(cls.id) ?? [] })),
  }
}

/** 로그인한 사람의 학원 역할·반·자녀를 한 번에 불러온다 (수업·출석 탭, 홈 요약) */
export function useMySchedule(userId: string | undefined) {
  return useAsync(
    () =>
      userId
        ? loadMySchedule(userId)
        : Promise.resolve<MySchedule>({ staffAcademies: [], staffClasses: [], children: [], childClasses: [] }),
    [userId],
  )
}
