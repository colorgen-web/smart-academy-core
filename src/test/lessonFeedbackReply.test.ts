import { beforeAll, describe, expect, it } from 'vitest'

import { personaOf, type PersonaKey } from '@/verify/mode'
import { createTestDb, type TestDb } from '@/test/db'

/** 수업 이해도 강사 답변 (샘플: 이민준이 초등 사고력 수학 A반에 남긴 지난 이해도) */

let t: TestDb
let row: { class_id: number; student_id: number; date: string }

beforeAll(async () => {
  t = await createTestDb()
  const { rows } = await t.db.query<{ class_id: number; student_id: number; date: string }>(
    `select f.class_id, f.student_id, f.date::text as date
     from public.lesson_feedback f join public.students s on s.id = f.student_id
     where s.name = '이민준' and f.reply is null
     order by f.date desc limit 1`,
  )
  row = rows[0]
})

const reply = (who: PersonaKey, text: string) =>
  t.as(who, `select public.set_lesson_feedback_reply($1::bigint, $2::bigint, $3::date, $4::text)`, [
    row.class_id,
    row.student_id,
    row.date,
    text,
  ])

const saved = async () =>
  (
    await t.db.query<{ reply: string | null; reply_by: string | null }>(
      `select reply, reply_by from public.lesson_feedback where class_id = $1 and student_id = $2 and date = $3`,
      [row.class_id, row.student_id, row.date],
    )
  ).rows[0]

const replyNotices = async (who: PersonaKey) =>
  (
    await t.db.query<{ n: number }>(
      `select count(*)::int as n from public.notifications where user_id = $1 and type = 'feedback_reply'`,
      [personaOf(who).id],
    )
  ).rows[0].n

describe('수업 이해도 강사 답변', () => {
  it('샘플에 답변 달 기록이 있다', () => {
    expect(row).toBeDefined()
  })

  it('학생·학부모·외부인은 답변을 달 수 없다', async () => {
    await expect(reply('student', '내가 쓴 답변')).rejects.toThrow('원장·강사만')
    await expect(reply('parent', '학부모 답변')).rejects.toThrow('원장·강사만')
    await expect(reply('newbie', '외부인 답변')).rejects.toThrow('원장·강사만')
  })

  it('직접 update 는 막힌다', async () => {
    await expect(
      t.as('teacher', `update public.lesson_feedback set reply = '우회' where class_id = $1`, [row.class_id]),
    ).rejects.toThrow()
  })

  it('강사가 답변을 달면 저장되고 학생 본인과 학부모에게 알림이 간다', async () => {
    await reply('teacher', '  다음 시간에 다시 설명해 줄게요  ')
    expect(await saved()).toEqual({ reply: '다음 시간에 다시 설명해 줄게요', reply_by: personaOf('teacher').id })
    expect(await replyNotices('student')).toBe(1)
    expect(await replyNotices('parent')).toBe(1)
    expect(await replyNotices('teacher')).toBe(0)
  })

  it('학생·학부모는 답변을 볼 수 있다', async () => {
    for (const who of ['student', 'parent'] as const) {
      const rows = await t.as<{ reply: string }>(
        who,
        `select reply from public.lesson_feedback where class_id = $1 and student_id = $2 and date = $3`,
        [row.class_id, row.student_id, row.date],
      )
      expect(rows[0]?.reply).toBe('다음 시간에 다시 설명해 줄게요')
    }
  })

  it('같은 내용으로 다시 저장하면 알림이 또 가지 않고, 고치면 다시 간다', async () => {
    await reply('teacher', '다음 시간에 다시 설명해 줄게요')
    expect(await replyNotices('student')).toBe(1)
    await reply('director', '원장입니다. 보충 자료 보내 드릴게요.')
    expect((await saved()).reply_by).toBe(personaOf('director').id)
    expect(await replyNotices('student')).toBe(2)
  })

  it('학생이 이해도를 고쳐도 답변은 남는다', async () => {
    const { rows } = await t.db.query<{ rating: number }>(
      `select rating from public.lesson_feedback where class_id = $1 and student_id = $2 and date = $3`,
      [row.class_id, row.student_id, row.date],
    )
    await t.db.query(
      `update public.lesson_feedback set rating = $4 where class_id = $1 and student_id = $2 and date = $3`,
      [row.class_id, row.student_id, row.date, rows[0].rating === 5 ? 4 : 5],
    )
    expect((await saved()).reply).toBe('원장입니다. 보충 자료 보내 드릴게요.')
  })

  it('빈 값으로 저장하면 답변이 지워진다', async () => {
    await reply('teacher', '   ')
    expect(await saved()).toEqual({ reply: null, reply_by: null })
    expect(await replyNotices('student')).toBe(2)
  })

  it('300자를 넘거나 기록이 없는 날에는 답변할 수 없다', async () => {
    await expect(reply('teacher', '가'.repeat(301))).rejects.toThrow('300자')
    await expect(
      t.as('teacher', `select public.set_lesson_feedback_reply($1::bigint, $2::bigint, '2000-01-01'::date, '답변')`, [
        row.class_id,
        row.student_id,
      ]),
    ).rejects.toThrow('이해도가 없습니다')
  })
})
