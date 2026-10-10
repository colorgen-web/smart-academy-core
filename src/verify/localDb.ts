import type { PGlite, Transaction } from '@electric-sql/pglite'

import type { Persona } from '@/verify/mode'

/**
 * 검증 모드용 브라우저 안 데이터베이스 (PGlite = WebAssembly PostgreSQL, IndexedDB 에 저장).
 * supabase/migrations 의 SQL 을 그대로 적용해서 실제 DB 와 같은 테이블·권한(RLS)·함수·트리거로 동작한다.
 * 이 파일은 검증 모드를 켰을 때만 불러온다 (일반 사용자는 내려받지 않음).
 */

const DB_NAME = 'smart-academy-verify'

// Supabase 가 기본으로 갖고 있는 것 중 마이그레이션이 쓰는 부분 (역할, auth 스키마)
const BOOTSTRAP = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_app_meta_data jsonb not null default '{}',
    raw_user_meta_data jsonb not null default '{}',
    created_at timestamptz not null default now()
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), auth.jwt() ->> 'sub'), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;

  create schema verify_meta;
  create table verify_meta.applied (name text primary key, applied_at timestamptz not null default now());
  create table verify_meta.info (key text primary key, value text);
`

const migrations = import.meta.glob<string>('../../supabase/migrations/*.sql', { query: '?raw', import: 'default' })

let dbPromise: Promise<PGlite> | null = null

/** 검증 DB (처음이면 만들고 샘플 데이터를 넣는다. 새 마이그레이션이 있으면 적용) */
export function getVerifyDb() {
  dbPromise ??= open().catch((e) => {
    dbPromise = null
    throw e
  })
  return dbPromise
}

async function open() {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = await PGlite.create(`idb://${DB_NAME}`)
  const { rows } = await db.query<{ ready: boolean }>(`select to_regclass('verify_meta.applied') is not null as ready`)
  const fresh = !rows[0].ready
  if (fresh) await db.exec(BOOTSTRAP)

  const applied = new Set(
    (await db.query<{ name: string }>('select name from verify_meta.applied')).rows.map((r) => r.name),
  )
  for (const path of Object.keys(migrations).sort()) {
    const name = path.split('/').pop()!
    if (applied.has(name)) continue
    const sql = await migrations[path]()
    await db.transaction(async (tx) => {
      await tx.exec(sql)
      await tx.query('insert into verify_meta.applied (name) values ($1)', [name])
    })
  }

  if (fresh) {
    const { seedVerifyData } = await import('@/verify/seed')
    await seedVerifyData(db)
    await db.query(`insert into verify_meta.info values ('seeded_at', now()::text)`)
  }
  return db
}

/** 검증 데이터를 지운다 (다음에 열면 샘플 데이터로 새로 시작) */
export async function resetVerifyDb() {
  const current = dbPromise
  dbPromise = null
  if (current) {
    const db = await current.catch(() => null)
    await db?.close().catch(() => undefined)
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(`/pglite/${DB_NAME}`)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}

/** 그 사람으로 로그인한 것처럼 (RLS·auth.uid() 가 그 사람 기준) 트랜잭션 안에서 실행 */
export async function asPersona<T>(db: PGlite, persona: Persona, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    // 탈퇴(계정 삭제) 후에도 다시 쓸 수 있게 로그인 계정은 항상 있게 한다
    await tx.query(
      `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3, $4)
       on conflict (id) do update set raw_app_meta_data = excluded.raw_app_meta_data`,
      [
        persona.id,
        `${persona.key}@verify.local`,
        JSON.stringify(appMetadata(persona)),
        JSON.stringify({ name: persona.name }),
      ],
    )
    const claims = { sub: persona.id, role: 'authenticated', app_metadata: appMetadata(persona) }
    await tx.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [
      JSON.stringify(claims),
      persona.id,
    ])
    await tx.exec('set local role authenticated')
    return fn(tx)
  })
}

function appMetadata(p: Persona) {
  return {
    provider: p.provider,
    ...(p.provider === 'naver' ? { naver_id: p.key, naver_email: `${p.key}@naver.verify.local` } : {}),
    ...(p.admin ? { role: 'admin' } : {}),
  }
}
