import { supabase } from '@/lib/supabase'
import { addDays, todayKST, weekdayOf } from '@/lib/date'
import type { ClassInfo } from '@/lib/classes'

/** 수업 이해도 (학생 자기 평가, 1~5) */
export type Rating = 1 | 2 | 3 | 4 | 5

export const RATINGS: Rating[] = [5, 4, 3, 2, 1]

export const RATING_LABEL: Record<Rating, string> = {
  1: '전혀 모르겠어요',
  2: '조금 어려워요',
  3: '보통이에요',
  4: '대부분 이해했어요',
  5: '완벽히 이해했어요',
}

/** 오늘 포함 며칠 전 수업까지 남길 수 있나 (DB 함수와 같다) */
export const FEEDBACK_DAYS = 7

export type LessonFeedback = {
  class_id: number
  student_id: number
  date: string
  rating: Rating
  comment: string | null
  updated_at: string
}

function db() {
  if (!supabase) throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  return supabase
}

export async function fetchLessonFeedback(filter: {
  classIds?: number[]
  studentIds?: number[]
  from: string
  to: string
}): Promise<LessonFeedback[]> {
  let query = db()
    .from('lesson_feedback')
    .select('class_id, student_id, date, rating, comment, updated_at')
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
  return data as LessonFeedback[]
}

/** 남기기·고치기, rating 이 null 이면 지우기 */
export async function setLessonFeedback(
  classId: number,
  studentId: number,
  date: string,
  rating: Rating | null,
  comment: string,
) {
  const { error } = await db().rpc('set_lesson_feedback', {
    p_class_id: classId,
    p_student_id: studentId,
    p_date: date,
    p_rating: rating,
    p_comment: comment,
  })
  if (error) throw error
}

/** 학생 본인으로 연결된 학생 id (학부모 연결 제외). 확인하지 못하면 빈 목록 */
export async function fetchMyOwnStudentIds(): Promise<number[]> {
  const { data, error } = await db().rpc('my_own_student_ids')
  if (error) return []
  return (data as number[] | null) ?? []
}

/** 그 요일의 가장 최근 수업 날짜 (오늘 포함, 7일 안) */
export function latestDateOfWeekday(weekday: number, today = todayKST()) {
  return addDays(today, -((weekdayOf(today) - weekday + 7) % 7))
}

/** 이해도를 남길 수 있는 날인가: 최근 7일 안, 그 반 시간표 요일 */
export function canRateDate(cls: Pick<ClassInfo, 'schedules' | 'active'>, date: string, today = todayKST()) {
  return (
    cls.active &&
    date <= today &&
    date >= addDays(today, -(FEEDBACK_DAYS - 1)) &&
    cls.schedules.some((s) => s.weekday === weekdayOf(date))
  )
}

/** 남길 수 있는 가장 최근 수업 날짜 (없으면 null) */
export function latestRatableDate(cls: Pick<ClassInfo, 'schedules' | 'active'>, today = todayKST()) {
  for (let i = 0; i < FEEDBACK_DAYS; i++) {
    const date = addDays(today, -i)
    if (canRateDate(cls, date, today)) return date
  }
  return null
}

/** 평균과 변화: 최근 n회 평균 vs 그 전 n회 평균 */
export function feedbackSummary(records: Pick<LessonFeedback, 'rating' | 'date'>[], n = 4) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))
  const avg = (list: { rating: number }[]) =>
    list.length ? list.reduce((sum, r) => sum + r.rating, 0) / list.length : null
  const recent = avg(sorted.slice(0, n))
  const previous = avg(sorted.slice(n, n * 2))
  return {
    count: sorted.length,
    average: avg(sorted),
    recent,
    delta: recent !== null && previous !== null ? recent - previous : null,
  }
}
