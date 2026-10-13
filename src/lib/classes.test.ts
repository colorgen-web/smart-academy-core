import { describe, expect, it } from 'vitest'

import { classesOnWeekday, formatSchedules, type ClassInfo } from '@/lib/classes'
import { canRateDate, feedbackSummary, latestDateOfWeekday, latestRatableDate, type Rating } from '@/lib/feedback'

const cls = (id: number, schedules: ClassInfo['schedules'], active = true) =>
  ({ id, academy_id: 1, name: `반${id}`, subject: null, room: null, teacher_id: null, active, schedules }) as ClassInfo

describe('시간표', () => {
  it('formatSchedules 는 같은 시간끼리 묶는다', () => {
    expect(formatSchedules([])).toBe('시간표 없음')
    expect(
      formatSchedules([
        { weekday: 1, start_time: '16:00:00', end_time: '17:30:00' },
        { weekday: 3, start_time: '16:00:00', end_time: '17:30:00' },
        { weekday: 5, start_time: '15:00:00', end_time: '16:00:00' },
      ]),
    ).toBe('월·수 16:00–17:30, 금 15:00–16:00')
  })

  it('classesOnWeekday 는 운영 중인 반만 시작 시간 순', () => {
    const a = cls(1, [{ weekday: 2, start_time: '17:00:00', end_time: '18:00:00' }])
    const b = cls(2, [{ weekday: 2, start_time: '15:00:00', end_time: '16:00:00' }])
    const closed = cls(3, [{ weekday: 2, start_time: '14:00:00', end_time: '15:00:00' }], false)
    const other = cls(4, [{ weekday: 3, start_time: '14:00:00', end_time: '15:00:00' }])
    expect(classesOnWeekday([a, b, closed, other], 2).map((x) => x.cls.id)).toEqual([2, 1])
  })
})

describe('수업 이해도', () => {
  // 2026-10-13 은 화요일
  const today = '2026-10-13'
  const monWed = cls(1, [
    { weekday: 1, start_time: '16:00:00', end_time: '17:00:00' },
    { weekday: 3, start_time: '16:00:00', end_time: '17:00:00' },
  ])

  it('latestDateOfWeekday 는 오늘 포함 7일 안', () => {
    expect(latestDateOfWeekday(2, today)).toBe('2026-10-13')
    expect(latestDateOfWeekday(1, today)).toBe('2026-10-12')
    expect(latestDateOfWeekday(3, today)).toBe('2026-10-07')
  })

  it('canRateDate: 시간표 요일, 최근 7일, 미래 불가, 운영 중인 반', () => {
    expect(canRateDate(monWed, '2026-10-12', today)).toBe(true)
    expect(canRateDate(monWed, '2026-10-07', today)).toBe(true)
    expect(canRateDate(monWed, '2026-10-13', today)).toBe(false) // 화요일 수업 없음
    expect(canRateDate(monWed, '2026-10-05', today)).toBe(false) // 8일 전
    expect(canRateDate(monWed, '2026-10-14', today)).toBe(false) // 미래
    expect(canRateDate({ ...monWed, active: false }, '2026-10-12', today)).toBe(false)
  })

  it('latestRatableDate', () => {
    expect(latestRatableDate(monWed, today)).toBe('2026-10-12')
    expect(latestRatableDate(cls(2, []), today)).toBeNull()
  })

  it('feedbackSummary 는 최근 n회와 그 전 n회를 비교', () => {
    const records = ([1, 2, 3, 4, 5, 5] as Rating[]).map((rating, i) => ({ rating, date: `2026-10-0${i + 1}` }))
    const s = feedbackSummary(records, 2)
    expect(s.count).toBe(6)
    expect(s.average).toBeCloseTo(20 / 6)
    expect(s.recent).toBe(5)
    expect(s.delta).toBe(1.5) // 최근 (5,5) 평균 5 − 그 전 (3,4) 평균 3.5
    expect(feedbackSummary([]).average).toBeNull()
  })
})
