import { describe, expect, it } from 'vitest'

import { academyTones } from '@/lib/academyColor'

describe('학원 구분 색', () => {
  it('학원이 하나면 색을 붙이지 않는다', () => {
    expect(academyTones([3, 3, 3]).size).toBe(0)
  })

  it('학원 id 순서로 서로 다른 색을 준다 (목록 순서와 무관)', () => {
    const a = academyTones([9, 2, 9, 5])
    const b = academyTones([5, 2, 9])
    expect([...a.keys()]).toEqual([2, 5, 9])
    expect(a.get(2)).toEqual(b.get(2))
    expect(new Set([...a.values()].map((t) => t.dot)).size).toBe(3)
  })
})
