import { beforeAll, describe, expect, it } from 'vitest'

import { personaOf } from '@/verify/mode'
import { createTestDb, type TestDb } from '@/test/db'

/** 웹 푸시 구독: 저장은 save_push_subscription 으로만, 보기·지우기는 본인 것만 */

let t: TestDb
beforeAll(async () => {
  t = await createTestDb()
})

const save = (who: 'parent' | 'teacher' | 'student', endpoint: string, p256dh = 'key', auth = 'secret') =>
  t.as(who, `select public.save_push_subscription($1::text, $2::text, $3::text, 'test-agent')`, [
    endpoint,
    p256dh,
    auth,
  ])

const mine = (who: 'parent' | 'teacher' | 'student') =>
  t.as<{ endpoint: string }>(who, `select endpoint from public.push_subscriptions order by id`)

const owner = async (endpoint: string) =>
  (
    await t.db.query<{ user_id: string }>(`select user_id from public.push_subscriptions where endpoint = $1`, [
      endpoint,
    ])
  ).rows[0]?.user_id

describe('푸시 구독 저장', () => {
  it('로그인한 사람이 자기 구독을 저장하고 자기 것만 본다', async () => {
    await save('parent', 'https://push.example.com/parent-phone')
    await save('teacher', 'https://push.example.com/teacher-pc')

    expect((await mine('parent')).map((r) => r.endpoint)).toEqual(['https://push.example.com/parent-phone'])
    expect((await mine('teacher')).map((r) => r.endpoint)).toEqual(['https://push.example.com/teacher-pc'])
    expect(await mine('student')).toEqual([])
  })

  it('같은 기기를 다시 저장하면 키만 바뀌고 하나로 남는다', async () => {
    await save('parent', 'https://push.example.com/parent-phone', 'new-key', 'new-secret')
    const rows = await t.db.query<{ p256dh: string }>(
      `select p256dh from public.push_subscriptions where endpoint = 'https://push.example.com/parent-phone'`,
    )
    expect(rows.rows.map((r) => r.p256dh)).toEqual(['new-key'])
  })

  it('같은 브라우저에서 다른 계정으로 켜면 지금 계정 것으로 옮겨진다', async () => {
    await save('student', 'https://push.example.com/shared-tablet')
    await save('parent', 'https://push.example.com/shared-tablet')
    expect(await owner('https://push.example.com/shared-tablet')).toBe(personaOf('parent').id)
    expect(await mine('student')).toEqual([])
  })

  it('https 가 아니거나 키가 없으면 거절한다', async () => {
    await expect(save('parent', 'http://push.example.com/x')).rejects.toThrow('구독 정보가 올바르지 않습니다')
    await expect(save('parent', 'https://push.example.com/x', '')).rejects.toThrow('구독 정보가 올바르지 않습니다')
  })

  it('직접 insert·update 는 막힌다', async () => {
    await expect(
      t.as(
        'student',
        `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example.com/fake', 'k', 'a')`,
        [personaOf('parent').id],
      ),
    ).rejects.toThrow('permission denied')
    await expect(
      t.as('parent', `update public.push_subscriptions set endpoint = 'https://push.example.com/moved'`),
    ).rejects.toThrow('permission denied')
  })

  it('로그인하지 않으면 구독을 보거나 저장할 수 없다', async () => {
    await expect(t.asAnon(`select * from public.push_subscriptions`)).rejects.toThrow('permission denied')
    await expect(
      t.asAnon(`select public.save_push_subscription('https://push.example.com/anon', 'k', 'a')`),
    ).rejects.toThrow('permission denied')
  })
})

describe('푸시 구독 지우기', () => {
  it('남의 구독은 지워지지 않고 내 것만 지워진다', async () => {
    await t.as(
      'student',
      `delete from public.push_subscriptions where endpoint = 'https://push.example.com/teacher-pc'`,
    )
    expect(await owner('https://push.example.com/teacher-pc')).toBe(personaOf('teacher').id)

    await t.as(
      'teacher',
      `delete from public.push_subscriptions where endpoint = 'https://push.example.com/teacher-pc'`,
    )
    expect(await owner('https://push.example.com/teacher-pc')).toBeUndefined()
  })

  it('탈퇴하면 구독도 함께 지워진다', async () => {
    await save('student', 'https://push.example.com/student-phone')
    await t.as('student', `select public.delete_my_account()`)
    expect(await owner('https://push.example.com/student-phone')).toBeUndefined()
  })
})
