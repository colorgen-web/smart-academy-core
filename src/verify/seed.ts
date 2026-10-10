import type { PGlite } from '@electric-sql/pglite'

import { addDays, todayKST, weekdayOf } from '@/lib/date'
import { asPersona } from '@/verify/localDb'
import { personaOf, type PersonaKey } from '@/verify/mode'

/**
 * 검증 모드 샘플 데이터. 실제 화면과 같은 함수(RPC)로 만들어서 트리거·알림도 실제처럼 생긴다.
 * - 스마트수학학원(승인됨): 원장 김원장, 강사 박선생, 학부모 이엄마, 학생 이민준 / 최아빠는 가입 대기
 * - 튼튼영어학원: 운영자 승인 대기
 * - 반 2개, 학생 4명, 지난 3주 출석, 이민준의 수업 이해도 기록
 * - 신규 회원 정정신규는 회원가입 전
 */
export async function seedVerifyData(db: PGlite) {
  const run = (who: PersonaKey, sql: string, params: unknown[] = []) =>
    asPersona(db, personaOf(who), (tx) => tx.query<Record<string, unknown>>(sql, params as never[]))
  const one = async (who: PersonaKey, sql: string, params: unknown[] = []) =>
    Object.values((await run(who, sql, params)).rows[0] ?? {})[0]

  const today = todayKST()
  const wd = weekdayOf(today)

  // 회원가입
  const members: [PersonaKey, string][] = [
    ['admin', 'parent'],
    ['director', 'director'],
    ['teacher', 'teacher'],
    ['parent', 'parent'],
    ['student', 'student'],
    ['parent2', 'parent'],
  ]
  for (const [key, type] of members) {
    const p = personaOf(key)
    await run(key, `insert into public.profiles (id, name, phone, member_type, over_14_confirmed) values ($1, $2, $3, $4, true)`, [
      p.id,
      p.name,
      p.phone,
      type,
    ])
  }

  // 공지사항
  for (const [title, content, pinned] of [
    ['검증 모드 안내', '이 공지는 검증 모드 샘플 데이터예요. 실제 서비스에는 보이지 않아요.', true],
    ['10월 학원 관리 기능 업데이트', '수업 이해도 기능이 추가됐어요.', false],
    ['추석 연휴 고객센터 운영 안내', '연휴 기간에는 답변이 늦어질 수 있어요.', false],
  ] as const) {
    await run('admin', `insert into public.announcements (title, content, is_pinned) values ($1, $2, $3)`, [title, content, pinned])
  }

  // 학원: 하나는 승인, 하나는 승인 대기
  const academyId = Number(await one('director', `select public.register_academy('스마트수학학원', '0212345678', '서울시 강남구')`))
  await run('admin', `select public.review_academy($1, true)`, [academyId])
  await run('director', `select public.register_academy('튼튼영어학원', null, null)`)
  const code = String(await one('director', `select join_code from public.academies where id = $1`, [academyId]))

  // 가입 신청 → 원장 승인 (최아빠는 대기로 남김)
  for (const [key, role] of [
    ['teacher', 'teacher'],
    ['parent', 'parent'],
    ['student', 'student'],
    ['parent2', 'parent'],
  ] as [PersonaKey, string][]) {
    await run(key, `select public.request_academy_join($1, $2)`, [code, role])
    if (key !== 'parent2') {
      await run('director', `select public.decide_academy_member($1, $2, true)`, [academyId, personaOf(key).id])
    }
  }

  // 학생 명단 (이민준: 학생 본인 + 이엄마 자녀, 이서연: 이엄마 자녀, 박서윤: 최아빠 자녀)
  const parentPhone = personaOf('parent').phone
  const students: [string, string, string | null, string[]][] = [
    ['이민준', '초4', personaOf('student').phone, [parentPhone]],
    ['이서연', '초2', null, [parentPhone]],
    ['박서윤', '초4', null, [personaOf('parent2').phone]],
    ['정하준', '초5', null, []],
  ]
  const studentIds: number[] = []
  for (const [name, grade, phone, guardians] of students) {
    studentIds.push(
      Number(
        await one(
          'director',
          `insert into public.students (academy_id, name, grade, student_phone, guardian_phones) values ($1, $2, $3, $4, $5::text[]) returning id`,
          [academyId, name, grade, phone, `{${guardians.join(',')}}`],
        ),
      ),
    )
  }

  // 반: A반은 월·수·금 + 오늘, B반은 화·목
  const daysA = [...new Set([1, 3, 5, wd])]
  const schedule = (days: number[], start: string, end: string) =>
    JSON.stringify(days.map((weekday) => ({ weekday, start, end })))
  const classA = Number(
    await one('director', `select public.save_class(null, $1, '초등 사고력 수학 A반', '수학', '201호', $2, $3::jsonb)`, [
      academyId,
      personaOf('teacher').id,
      schedule(daysA, '16:00', '17:30'),
    ]),
  )
  const classB = Number(
    await one('director', `select public.save_class(null, $1, '초등 연산 B반', '수학', '202호', $2, $3::jsonb)`, [
      academyId,
      personaOf('director').id,
      schedule([2, 4], '15:00', '16:00'),
    ]),
  )
  const [minjun, seoyeon, seoyun, hajun] = studentIds
  for (const [cls, ids] of [
    [classA, [minjun, seoyun, hajun]],
    [classB, [minjun, seoyeon]],
  ] as [number, number[]][]) {
    for (const id of ids) await run('director', `insert into public.class_students (class_id, student_id) values ($1, $2)`, [cls, id])
  }

  // 지난 3주 출석 (오늘은 직접 체크해 보도록 비워 둠)
  // 날짜·학생마다 다르게: 대부분 출석, 가끔 지각·결석·사유
  const pattern = ['present', 'present', 'present', 'late', 'present', 'present', 'absent', 'present', 'present', 'excused', 'present']
  for (let back = 21; back >= 1; back--) {
    const date = addDays(today, -back)
    const day = weekdayOf(date)
    for (const [cls, days, ids] of [
      [classA, daysA, [minjun, seoyun, hajun]],
      [classB, [2, 4], [minjun, seoyeon]],
    ] as [number, number[], number[]][]) {
      if (!days.includes(day)) continue
      for (const id of ids) {
        const status = pattern[(back * 3 + id * 5) % pattern.length]
        await run('teacher', `select public.set_attendance($1, $2, $3::date, $4)`, [cls, id, date, status])
      }
    }
  }

  // 이민준의 지난 수업 이해도 (7일보다 오래된 기록은 학생 화면으로 못 남기므로 직접 넣는다)
  const ratings = [2, 3, 3, 2, 3, 4, 3, 4, 4, 5]
  const comments: Record<number, string> = { 1: '분수 덧셈이 헷갈렸어요', 4: '도형 돌리기가 어려워요', 8: '오늘은 잘 이해했어요!' }
  let r = 0
  for (let back = 28; back >= 1; back--) {
    const date = addDays(today, -back)
    if (!daysA.includes(weekdayOf(date)) || r >= ratings.length) continue
    const { rows } = await db.query<{ status: string }>(
      `select status from public.attendance where class_id = $1 and student_id = $2 and date = $3`,
      [classA, minjun, date],
    )
    const status = rows[0]?.status
    if (status === 'absent' || status === 'excused') continue
    // 지난 기록이라 학부모 알림 트리거는 끄고 넣는다
    await db.transaction(async (tx) => {
      await tx.exec('set local session_replication_role = replica')
      await tx.query(
        `insert into public.lesson_feedback (class_id, student_id, date, rating, comment, written_by) values ($1, $2, $3, $4, $5, $6)`,
        [classA, minjun, date, ratings[r], comments[r] ?? null, personaOf('student').id],
      )
    })
    r++
  }

  // 원장이 보낸 학원 알림
  await run('director', `select public.send_academy_message($1, '이번 주 보강 안내', '금요일 수업은 30분 일찍 시작해요.', '{teacher,parent,student}'::text[])`, [
    academyId,
  ])
}
