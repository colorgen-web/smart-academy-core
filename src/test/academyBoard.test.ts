import { beforeAll, describe, expect, it } from 'vitest'

import { personaOf, type PersonaKey } from '@/verify/mode'
import { createTestDb, type TestDb } from '@/test/db'

/** 학원 공지·게시판 권한과 알림 (샘플: 스마트수학학원 — 원장·강사·학부모·학생 승인, 최아빠 가입 대기) */

let t: TestDb
let academyId: number
/** 샘플 데이터에 들어 있는 글은 빼고 이 테스트가 쓴 글만 본다 */
let seededMaxId: number

beforeAll(async () => {
  t = await createTestDb()
  seededMaxId = Number(
    (await t.db.query<{ n: number }>(`select coalesce(max(id), 0) as n from public.academy_posts`)).rows[0].n,
  )
  academyId = Number(
    (await t.db.query<{ id: number }>(`select id from public.academies where name = '스마트수학학원'`)).rows[0].id,
  )
})

const save = (
  who: PersonaKey,
  post: {
    id?: number
    category: 'notice' | 'general'
    title: string
    content?: string
    pinned?: boolean
    audience?: string[]
  },
) =>
  t
    .as<{
      id: number
    }>(who, `select public.save_academy_post($1::bigint, $2::bigint, $3::text, $4::text, $5::text, $6::boolean, $7::text[]) as id`, [post.id ?? null, academyId, post.category, post.title, post.content ?? '', post.pinned ?? false, `{${(post.audience ?? ['teacher', 'parent', 'student']).join(',')}}`])
    .then((rows) => Number(rows[0].id))

const visibleTitles = async (who: PersonaKey) =>
  (await t.as<{ title: string }>(who, `select title from public.academy_posts where id > $1 order by id`, [seededMaxId])).map((r) => r.title)

const notified = async (who: PersonaKey, type: string, like: string) =>
  (
    await t.db.query<{ n: number }>(
      `select count(*)::int as n from public.notifications where user_id = $1 and type = $2 and title like $3`,
      [personaOf(who).id, type, like],
    )
  ).rows[0].n

describe('공지 쓰기', () => {
  it('원장·강사는 공지를 쓴다', async () => {
    expect(await save('director', { category: 'notice', title: '전체 공지', pinned: true })).toBeGreaterThan(0)
    expect(
      await save('teacher', { category: 'notice', title: '학부모 전용 공지', audience: ['parent'] }),
    ).toBeGreaterThan(0)
  })

  it('학부모·학생은 공지를 쓸 수 없다', async () => {
    await expect(save('parent', { category: 'notice', title: '몰래 공지' })).rejects.toThrow('원장·강사만')
    await expect(save('student', { category: 'notice', title: '몰래 공지' })).rejects.toThrow('원장·강사만')
  })

  it('가입 대기 회원과 다른 학원 사람은 아무 글도 못 쓴다', async () => {
    await expect(save('parent2', { category: 'general', title: '대기 중 글' })).rejects.toThrow('승인된 회원만')
    await expect(save('newbie', { category: 'general', title: '외부인 글' })).rejects.toThrow('승인된 회원만')
  })

  it('게시글은 고정할 수 없다 (고정 표시는 무시)', async () => {
    const id = await save('parent', { category: 'general', title: '학부모 게시글', pinned: true })
    const { rows } = await t.db.query<{ is_pinned: boolean }>(
      `select is_pinned from public.academy_posts where id = $1`,
      [id],
    )
    expect(rows[0].is_pinned).toBe(false)
  })

  it('직접 insert 는 막힌다', async () => {
    await expect(
      t.as('director', `insert into public.academy_posts (academy_id, category, title) values ($1, 'notice', '우회')`, [
        academyId,
      ]),
    ).rejects.toThrow()
  })
})

describe('글 보기', () => {
  it('원장·강사는 모두 본다', async () => {
    expect(await visibleTitles('director')).toEqual(['전체 공지', '학부모 전용 공지', '학부모 게시글'])
    expect(await visibleTitles('teacher')).toEqual(['전체 공지', '학부모 전용 공지', '학부모 게시글'])
  })

  it('학부모는 대상 공지와 게시글을 본다', async () => {
    expect(await visibleTitles('parent')).toEqual(['전체 공지', '학부모 전용 공지', '학부모 게시글'])
  })

  it('학생은 학부모 전용 공지를 못 본다', async () => {
    expect(await visibleTitles('student')).toEqual(['전체 공지', '학부모 게시글'])
  })

  it('가입 대기 회원과 외부인은 아무것도 못 본다', async () => {
    expect(await visibleTitles('parent2')).toEqual([])
    expect(await visibleTitles('newbie')).toEqual([])
  })
})

describe('공지 알림', () => {
  it('새 공지는 대상 회원에게 알림이 가고 쓴 사람은 받지 않는다', async () => {
    expect(await notified('teacher', 'academy_post', '%전체 공지')).toBe(1)
    expect(await notified('parent', 'academy_post', '%전체 공지')).toBe(1)
    expect(await notified('student', 'academy_post', '%전체 공지')).toBe(1)
    expect(await notified('director', 'academy_post', '%전체 공지')).toBe(0)
    expect(await notified('parent2', 'academy_post', '%전체 공지')).toBe(0)
  })

  it('대상이 아닌 역할은 알림을 받지 않는다 (원장은 항상 받음)', async () => {
    expect(await notified('parent', 'academy_post', '%학부모 전용 공지')).toBe(1)
    expect(await notified('student', 'academy_post', '%학부모 전용 공지')).toBe(0)
    expect(await notified('director', 'academy_post', '%학부모 전용 공지')).toBe(1)
  })

  it('게시글은 알림을 보내지 않는다', async () => {
    expect(await notified('director', 'academy_post', '%학부모 게시글')).toBe(0)
  })
})

describe('고치기·지우기', () => {
  it('본인 글만 고친다', async () => {
    const id = Number(
      (await t.db.query<{ id: number }>(`select id from public.academy_posts where title = '학부모 게시글'`)).rows[0]
        .id,
    )
    await expect(save('student', { id, category: 'general', title: '남의 글 고치기' })).rejects.toThrow(
      '본인이 쓴 글만',
    )
    await save('parent', { id, category: 'general', title: '학부모 게시글 (수정)' })
    expect(await visibleTitles('parent')).toContain('학부모 게시글 (수정)')
  })

  it('학부모는 남의 글을 못 지우고, 원장은 지울 수 있다', async () => {
    const id = Number(
      (await t.db.query<{ id: number }>(`select id from public.academy_posts where title = '전체 공지'`)).rows[0].id,
    )
    await t.as('parent', `delete from public.academy_posts where id = $1`, [id])
    expect(await visibleTitles('parent')).toContain('전체 공지')

    const other = await save('student', { category: 'general', title: '학생 게시글' })
    await t.as('director', `delete from public.academy_posts where id = $1`, [other])
    expect(await visibleTitles('director')).not.toContain('학생 게시글')
  })
})

describe('댓글', () => {
  let noticeId: number

  beforeAll(async () => {
    noticeId = Number(
      (await t.db.query<{ id: number }>(`select id from public.academy_posts where title = '학부모 전용 공지'`)).rows[0]
        .id,
    )
  })

  it('글을 볼 수 있으면 댓글을 달고, 글쓴이에게 알림이 간다', async () => {
    await t.as('parent', `insert into public.academy_post_comments (post_id, content) values ($1, '확인했습니다')`, [
      noticeId,
    ])
    expect(await notified('teacher', 'post_comment', '이엄마님이%')).toBe(1)
  })

  it('글을 볼 수 없으면 댓글을 달 수 없다', async () => {
    await expect(
      t.as('student', `insert into public.academy_post_comments (post_id, content) values ($1, '몰래 댓글')`, [
        noticeId,
      ]),
    ).rejects.toThrow()
  })

  it('작성자를 남으로 바꿔 쓸 수 없다', async () => {
    await expect(
      t.as('parent', `insert into public.academy_post_comments (post_id, content, author_id) values ($1, '사칭', $2)`, [
        noticeId,
        personaOf('teacher').id,
      ]),
    ).rejects.toThrow()
  })

  it('본인 댓글에는 알림이 가지 않는다', async () => {
    await t.as('teacher', `insert into public.academy_post_comments (post_id, content) values ($1, '감사합니다')`, [
      noticeId,
    ])
    expect(await notified('teacher', 'post_comment', '박선생님이%')).toBe(0)
  })

  it('작성자 이름은 소속 회원에게만 보인다', async () => {
    const rows = await t.as<{ name: string; role: string }>(
      'parent',
      `select name, role from public.academy_board_authors($1)`,
      [academyId],
    )
    // 학생 게시글은 원장이 지웠으므로 학생은 작성자 목록에 없다
    expect(rows.map((r) => r.name).sort()).toEqual(['김원장', '박선생', '이엄마'].sort())
    expect(await t.as('newbie', `select * from public.academy_board_authors($1)`, [academyId])).toEqual([])
  })
})

describe('회원 탈퇴', () => {
  it('탈퇴해도 글은 남고 작성자만 비운다', async () => {
    await t.as('parent', `select public.delete_my_account()`)
    const { rows } = await t.db.query<{ author_id: string | null }>(
      `select author_id from public.academy_posts where title = '학부모 게시글 (수정)'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].author_id).toBeNull()
  })
})
