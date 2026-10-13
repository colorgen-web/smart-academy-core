import { beforeEach, describe, expect, it } from 'vitest'

import { personaOf, type PersonaKey } from '@/verify/mode'
import { createTestDb, type TestDb } from '@/test/db'

/** 학원 삭제(폐원): 등록한 원장 또는 운영자만, 이름 확인 후. 딸린 데이터는 함께 지워지고 소속 회원에게 알림 */

let t: TestDb
let academyId: number
const NAME = '스마트수학학원'

// 삭제는 되돌릴 수 없으므로 테스트마다 새 DB
beforeEach(async () => {
  t = await createTestDb()
  academyId = Number(
    (await t.db.query<{ id: number }>(`select id from public.academies where name = $1`, [NAME])).rows[0].id,
  )
})

const remove = (who: PersonaKey, name: string, id = academyId) =>
  t.as(who, `select public.delete_academy($1::bigint, $2::text)`, [id, name])

const count = async (sql: string, params: unknown[] = []) =>
  (await t.db.query<{ n: number }>(`select count(*)::int as n from ${sql}`, params as never[])).rows[0].n

describe('학원 삭제 권한', () => {
  it('강사·학부모는 지울 수 없다', async () => {
    await expect(remove('teacher', NAME)).rejects.toThrow('원장이나 운영자만')
    await expect(remove('parent', NAME)).rejects.toThrow('원장이나 운영자만')
    expect(await count(`public.academies where id = $1`, [academyId])).toBe(1)
  })

  it('이름이 틀리면 지우지 않는다', async () => {
    await expect(remove('director', '스마트수학')).rejects.toThrow('이름이 맞지 않습니다')
    expect(await count(`public.academies where id = $1`, [academyId])).toBe(1)
  })

  it('직접 delete 는 막힌다', async () => {
    await t.as('director', `delete from public.academies where id = $1`, [academyId]).catch(() => undefined)
    expect(await count(`public.academies where id = $1`, [academyId])).toBe(1)
  }, 60_000)
})

describe('원장이 삭제', () => {
  it('딸린 데이터가 모두 지워지고 소속 회원에게 알림이 간다', async () => {
    expect(await count(`public.students where academy_id = $1`, [academyId])).toBeGreaterThan(0)

    await remove('director', ` ${NAME} `)

    expect(await count(`public.academies where id = $1`, [academyId])).toBe(0)
    for (const table of ['academy_members', 'students', 'classes', 'academy_posts', 'notifications']) {
      expect(await count(`public.${table} where academy_id = $1`, [academyId]), table).toBe(0)
    }
    expect(await count(`public.attendance`)).toBe(0)
    expect(await count(`public.lesson_feedback`)).toBe(0)

    const closed = (who: PersonaKey) =>
      count(`public.notifications where user_id = $1 and type = 'academy_closed'`, [personaOf(who).id])
    expect(await closed('teacher')).toBe(1)
    expect(await closed('parent')).toBe(1)
    expect(await closed('student')).toBe(1)
    expect(await closed('director')).toBe(0) // 지운 사람
    expect(await closed('parent2')).toBe(0) // 가입 대기
  }, 60_000)

  it('지운 뒤에는 운영 중인 학원이 없어 원장도 탈퇴할 수 있다', async () => {
    expect(await t.as('director', `select * from public.account_deletion_blockers()`)).toHaveLength(1)
    await remove('director', NAME)
    expect(await t.as('director', `select * from public.account_deletion_blockers()`)).toHaveLength(0)
  }, 60_000)

  it('승인 대기 학원도 등록한 원장이 지울 수 있다', async () => {
    const pending = Number(
      (await t.db.query<{ id: number }>(`select id from public.academies where status = 'pending'`)).rows[0].id,
    )
    await remove('director', '튼튼영어학원', pending)
    expect(await count(`public.academies where id = $1`, [pending])).toBe(0)
  }, 60_000)
})

describe('운영자가 삭제', () => {
  it('운영자는 어느 학원이든 지울 수 있다', async () => {
    await remove('admin', NAME)
    expect(await count(`public.academies where id = $1`, [academyId])).toBe(0)
    expect(
      await count(`public.notifications where user_id = $1 and type = 'academy_closed'`, [personaOf('director').id]),
    ).toBe(1)
  }, 60_000)
})
