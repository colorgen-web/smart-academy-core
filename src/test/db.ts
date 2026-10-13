/// <reference types="node" />
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'

import { applyMigrations, asPersona, BOOTSTRAP } from '@/verify/localDb'
import { personaOf, type PersonaKey } from '@/verify/mode'
import { seedVerifyData } from '@/verify/seed'

/**
 * 테스트용 DB: 메모리 PGlite 에 supabase/migrations 를 그대로 적용하고 검증 모드 샘플 데이터를 넣는다.
 * 실제 DB 와 같은 테이블·RLS·함수·트리거로 권한과 흐름을 확인할 수 있다.
 */
export async function createTestDb() {
  const db = await PGlite.create()
  await db.exec(BOOTSTRAP)
  await applyMigrations(db, await migrationFiles())
  await seedVerifyData(db)

  /** 그 역할로 로그인한 것처럼 SQL 실행 */
  const as = <T = Record<string, unknown>>(who: PersonaKey, sql: string, params: unknown[] = []) =>
    asPersona(db, personaOf(who), async (tx) => (await tx.query<T>(sql, params as never[])).rows)

  /** 비로그인(anon) 으로 SQL 실행 */
  const asAnon = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    db.transaction(async (tx) => {
      await tx.exec(`select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)`)
      await tx.exec('set local role anon')
      return (await tx.query<T>(sql, params as never[])).rows
    })

  return { db, as, asAnon }
}

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../supabase/migrations')

async function migrationFiles() {
  const names = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith('.sql'))
  return Object.fromEntries(names.map((n) => [n, () => readFile(path.join(MIGRATIONS_DIR, n), 'utf8')]))
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>
