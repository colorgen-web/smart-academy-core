import { beforeAll, describe, expect, it } from 'vitest'

import { addDays, todayKST } from '@/lib/date'
import { personaOf } from '@/verify/mode'
import { createTestDb, type TestDb } from '@/test/db'

/**
 * DB 권한·흐름 테스트. supabase/migrations 를 메모리 PGlite 에 그대로 적용하고
 * 검증 모드 샘플 데이터(src/verify/seed.ts) 위에서 역할별로 확인한다.
 * 샘플: 스마트수학학원(승인) — 원장 김원장, 강사 박선생, 학부모 이엄마(이민준·이서연), 학생 이민준, 최아빠는 가입 대기
 */

let t: TestDb
let academyId: number
let classA: number
let studentIds: Record<string, number>

beforeAll(async () => {
  t = await createTestDb()
  academyId = Number((await t.db.query<{ id: number }>(`select id from public.academies where name = '스마트수학학원'`)).rows[0].id)
  classA = Number((await t.db.query<{ id: number }>(`select id from public.classes where name like '%A반'`)).rows[0].id)
  const { rows } = await t.db.query<{ id: number; name: string }>(`select id, name from public.students`)
  studentIds = Object.fromEntries(rows.map((r) => [r.name, Number(r.id)]))
})

const names = (rows: { name: unknown }[]) => rows.map((r) => r.name).sort()

describe('마이그레이션과 샘플 데이터', () => {
  it('모든 마이그레이션이 적용되고 샘플 데이터가 들어간다', async () => {
    const { rows } = await t.db.query<{ n: number }>(`select count(*)::int as n from public.students`)
    expect(rows[0].n).toBe(4)
  })
})

describe('학생 명단 보기 (RLS)', () => {
  it('원장·강사는 학원 학생을 모두 본다', async () => {
    expect(await t.as('director', `select name from public.students`)).toHaveLength(4)
    expect(await t.as('teacher', `select name from public.students`)).toHaveLength(4)
  })

  it('학부모는 연락처가 연결된 자녀만 본다', async () => {
    expect(names(await t.as<{ name: string }>('parent', `select name from public.students`))).toEqual(['이민준', '이서연'])
  })

  it('학생은 본인만 본다', async () => {
    expect(names(await t.as<{ name: string }>('student', `select name from public.students`))).toEqual(['이민준'])
  })

  it('가입 대기 학부모와 가입 전 회원은 아무도 못 본다', async () => {
    expect(await t.as('parent2', `select name from public.students`)).toHaveLength(0)
    expect(await t.as('newbie', `select name from public.students`)).toHaveLength(0)
  })

  it('비로그인은 학생 명단에 접근할 수 없다', async () => {
    await expect(t.asAnon(`select name from public.students`)).rejects.toThrow()
  })
})

describe('학원 쓰기 권한', () => {
  it('강사·학부모는 학생을 등록할 수 없다', async () => {
    for (const who of ['teacher', 'parent'] as const) {
      await expect(
        t.as(who, `insert into public.students (academy_id, name) values ($1, '몰래등록')`, [academyId]),
      ).rejects.toThrow()
    }
  })

  it('원장 회원이 아니면 학원을 등록할 수 없다', async () => {
    await expect(t.as('teacher', `select public.register_academy('몰래학원', null, null)`)).rejects.toThrow()
  })

  it('운영자가 아니면 학원을 승인할 수 없다', async () => {
    const pending = (await t.db.query<{ id: number }>(`select id from public.academies where status = 'pending'`)).rows[0].id
    await expect(t.as('director', `select public.review_academy($1, true)`, [pending])).rejects.toThrow()
  })

  it('틀린 가입 코드로는 가입 신청이 안 된다', async () => {
    await expect(t.as('newbie', `select public.request_academy_join('000000', 'parent')`)).rejects.toThrow()
  })
})

describe('출석', () => {
  it('학부모·학생은 출석을 체크할 수 없다', async () => {
    for (const who of ['parent', 'student'] as const) {
      await expect(
        t.as(who, `select public.set_attendance($1, $2, $3::date, 'present')`, [classA, studentIds['이민준'], todayKST()]),
      ).rejects.toThrow('원장·강사만')
    }
  })

  it('미래 날짜는 기록할 수 없다', async () => {
    await expect(
      t.as('teacher', `select public.set_attendance($1, $2, $3::date, 'present')`, [
        classA,
        studentIds['이민준'],
        addDays(todayKST(), 2),
      ]),
    ).rejects.toThrow('미래 날짜')
  })

  it('수강생이 아니면 기록할 수 없다', async () => {
    await expect(
      t.as('teacher', `select public.set_attendance($1, $2, $3::date, 'present')`, [classA, studentIds['이서연'], todayKST()]),
    ).rejects.toThrow('수강생이 아닙니다')
  })

  it('오늘 출석을 체크하면 연결된 학부모와 학생 본인에게 알림이 간다', async () => {
    const countFor = async (who: 'parent' | 'student' | 'parent2') =>
      (
        await t.db.query<{ n: number }>(
          `select count(*)::int as n from public.notifications where user_id = $1 and type = 'attendance' and title = '이민준 지각'`,
          [personaOf(who).id],
        )
      ).rows[0].n

    await t.as('teacher', `select public.set_attendance($1, $2, $3::date, 'late')`, [classA, studentIds['이민준'], todayKST()])

    expect(await countFor('parent')).toBe(1)
    expect(await countFor('student')).toBe(1)
    expect(await countFor('parent2')).toBe(0)
  })

  it('지난 날짜를 고칠 때는 알리지 않는다', async () => {
    const before = (await t.db.query<{ n: number }>(`select count(*)::int as n from public.notifications`)).rows[0].n
    const { rows } = await t.db.query<{ date: string; status: string }>(
      `select date::text, status from public.attendance where class_id = $1 and student_id = $2 and date < $3::date order by date desc limit 1`,
      [classA, studentIds['이민준'], todayKST()],
    )
    const next = rows[0].status === 'absent' ? 'present' : 'absent'
    await t.as('teacher', `select public.set_attendance($1, $2, $3::date, $4)`, [classA, studentIds['이민준'], rows[0].date, next])
    const after = (await t.db.query<{ n: number }>(`select count(*)::int as n from public.notifications`)).rows[0].n
    expect(after).toBe(before)
  })
})

describe('알림', () => {
  it('본인 알림만 보인다', async () => {
    const rows = await t.as<{ user_id: string }>('parent', `select user_id from public.notifications`)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.user_id === personaOf('parent').id)).toBe(true)
  })

  it('사용자가 직접 알림을 만들 수 없다', async () => {
    await expect(
      t.as('parent', `insert into public.notifications (user_id, type, title) values ($1, 'attendance', '가짜')`, [
        personaOf('student').id,
      ]),
    ).rejects.toThrow()
  })
})

describe('공지사항', () => {
  it('비로그인도 읽을 수 있다', async () => {
    expect((await t.asAnon(`select title from public.announcements`)).length).toBeGreaterThan(0)
  })

  it('운영자만 쓸 수 있다', async () => {
    await expect(
      t.as('director', `insert into public.announcements (title, content) values ('원장 공지', '내용')`),
    ).rejects.toThrow()
    await expect(
      t.as('admin', `insert into public.announcements (title, content) values ('운영자 공지', '내용')`),
    ).resolves.toBeDefined()
  })
})
