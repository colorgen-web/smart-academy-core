import { describe, expect, it } from 'vitest'

import { formatAcademyPhone, errorMessage } from '@/lib/academies'
import { formatPhone, isValidPhone, maskPhone, normalizePhone } from '@/lib/profile'

describe('휴대폰 번호', () => {
  it('normalizePhone 은 숫자만 11자리까지', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678')
    expect(normalizePhone('010 1234 56789')).toBe('01012345678')
  })

  it('isValidPhone', () => {
    expect(isValidPhone('01012345678')).toBe(true)
    expect(isValidPhone('0111234567')).toBe(true)
    expect(isValidPhone('0212345678')).toBe(false)
    expect(isValidPhone('0101234')).toBe(false)
  })

  it('formatPhone 은 입력 중인 값도 처리', () => {
    expect(formatPhone('010')).toBe('010')
    expect(formatPhone('0101234')).toBe('010-1234')
    expect(formatPhone('0111234567')).toBe('011-123-4567')
    expect(formatPhone('01012345678')).toBe('010-1234-5678')
  })

  it('maskPhone', () => {
    expect(maskPhone('01012345678')).toBe('010-****-5678')
  })

  it('formatAcademyPhone', () => {
    expect(formatAcademyPhone('021234567')).toBe('02-123-4567')
    expect(formatAcademyPhone('0212345678')).toBe('02-1234-5678')
    expect(formatAcademyPhone('0311234567')).toBe('031-123-4567')
    expect(formatAcademyPhone(null)).toBeNull()
  })
})

describe('errorMessage', () => {
  it('DB 함수의 한국어 안내는 그대로 보여 준다', () => {
    expect(errorMessage({ code: 'P0001', message: '권한이 없어요' }, '실패')).toBe('권한이 없어요')
  })

  it('그 밖의 오류는 fallback', () => {
    expect(errorMessage({ code: 'P0001', message: 'permission denied' }, '실패')).toBe('실패')
    expect(errorMessage({ code: '08006', message: '연결 끊김' }, '실패')).toBe('실패')
    expect(errorMessage(null, '실패')).toBe('실패')
  })
})
