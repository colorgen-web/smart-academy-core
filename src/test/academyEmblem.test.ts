import { beforeAll, describe, expect, it } from 'vitest'

import { createTestDb, type TestDb } from '@/test/db'

/** 학원 엠블렘: 원장·운영자만 바꿀 수 있고, 소속 회원은 볼 수 있다 */

let t: TestDb
let academyId: number
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

beforeAll(async () => {
  t = await createTestDb()
  academyId = Number(
    (await t.db.query<{ id: number }>(`select id from public.academies where name = '스마트수학학원'`)).rows[0].id,
  )
}, 60_000)

const set = (who: Parameters<TestDb['as']>[0], emblem: string | null) =>
  t.as(who, `select public.set_academy_emblem($1::bigint, $2::text)`, [academyId, emblem])

const emblemOf = async () =>
  (await t.db.query<{ emblem: string | null }>(`select emblem from public.academies where id = $1`, [academyId]))
    .rows[0].emblem

describe('학원 엠블렘', () => {
  it('원장이 올리면 저장되고 학생도 볼 수 있다', async () => {
    await set('director', PNG)
    expect(await emblemOf()).toBe(PNG)
    const rows = await t.as<{ emblem: string }>('student', `select emblem from public.academies where id = $1`, [
      academyId,
    ])
    expect(rows[0].emblem).toBe(PNG)
  })

  it('강사·학부모는 바꿀 수 없다', async () => {
    await expect(set('teacher', null)).rejects.toThrow('원장이나 운영자만')
    await expect(set('parent', null)).rejects.toThrow('원장이나 운영자만')
    expect(await emblemOf()).toBe(PNG)
  })

  it('이미지가 아니거나 너무 크면 거절한다', async () => {
    await expect(set('director', 'https://example.com/a.png')).rejects.toThrow('올바르지 않거나')
    await expect(set('director', 'data:image/svg+xml;base64,PHN2Zz4=')).rejects.toThrow('올바르지 않거나')
    await expect(set('director', 'data:image/png;base64,' + 'A'.repeat(200_000))).rejects.toThrow('너무 큽니다')
  })

  it('직접 update 는 막힌다', async () => {
    await t
      .as('director', `update public.academies set emblem = null where id = $1`, [academyId])
      .catch(() => undefined)
    expect(await emblemOf()).toBe(PNG)
  })

  it('운영자도 바꿀 수 있고, null 이면 지운다', async () => {
    await set('admin', null)
    expect(await emblemOf()).toBeNull()
  })
})
