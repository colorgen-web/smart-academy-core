import { describe, expect, it } from 'vitest'

import { addDays, formatDayLabel, formatRelative, formatTime, isValidDate, weekdayOf, weekRange } from '@/lib/date'

describe('date', () => {
  it('addDays 는 월·연도 경계를 넘는다', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('weekdayOf 는 0=일 … 6=토', () => {
    expect(weekdayOf('2026-10-11')).toBe(0)
    expect(weekdayOf('2026-10-13')).toBe(2)
  })

  it('weekRange 는 월요일~일요일', () => {
    expect(weekRange('2026-10-13')).toEqual({ start: '2026-10-12', end: '2026-10-18' })
    expect(weekRange('2026-10-18')).toEqual({ start: '2026-10-12', end: '2026-10-18' })
  })

  it('isValidDate', () => {
    expect(isValidDate('2026-10-13')).toBe(true)
    expect(isValidDate('2026-1-3')).toBe(false)
    expect(isValidDate('abc')).toBe(false)
    expect(isValidDate(null)).toBe(false)
  })

  it('formatDayLabel, formatTime', () => {
    expect(formatDayLabel('2026-10-06')).toBe('10월 6일 (화)')
    expect(formatTime('16:00:00')).toBe('16:00')
  })

  it('formatRelative', () => {
    const now = Date.parse('2026-10-13T12:00:00+09:00')
    expect(formatRelative('2026-10-13T11:59:30+09:00', now)).toBe('방금 전')
    expect(formatRelative('2026-10-13T11:55:00+09:00', now)).toBe('5분 전')
    expect(formatRelative('2026-10-13T09:00:00+09:00', now)).toBe('3시간 전')
    expect(formatRelative('2026-10-12T09:00:00+09:00', now)).toBe('어제')
    expect(formatRelative('2026-10-06T09:00:00+09:00', now)).toBe('10월 6일')
  })
})
