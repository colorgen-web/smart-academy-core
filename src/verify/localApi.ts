import type { Transaction } from '@electric-sql/pglite'

import { asPersona, getVerifyDb } from '@/verify/localDb'
import type { Persona } from '@/verify/mode'

/**
 * 검증 모드: 앱이 Supabase 로 보내는 요청(PostgREST·Edge Function)을 받아 브라우저 안 DB 로 처리한다.
 * 앱이 쓰는 기능만 구현한 작은 PostgREST: select(관계 포함)·필터·정렬·범위·개수, insert/update/delete, rpc.
 * 모든 요청은 고른 역할(persona)로 로그인한 것처럼 실행되어 실제와 같은 RLS·권한 검사를 받는다.
 */
export async function handleLocal(req: Request, persona: Persona): Promise<Response> {
  const url = new URL(req.url)
  const body = req.method === 'GET' || req.method === 'HEAD' ? null : await req.text()
  try {
    if (url.pathname.startsWith('/functions/v1/')) return edgeFunction(url.pathname.split('/').pop()!, body)
    const db = await getVerifyDb()
    const path = url.pathname.replace(/^\/rest\/v1\//, '')
    return await asPersona(db, persona, (tx) =>
      path.startsWith('rpc/') ? rpc(tx, ident(path.slice(4)), body) : table(tx, req, url, ident(path), body),
    )
  } catch (e) {
    return pgError(e)
  }
}

// ── 응답 ──

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(status === 204 || data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function pgError(e: unknown) {
  if (e instanceof ApiError) return json({ code: e.code, message: e.message, details: null, hint: null }, e.status)
  const err = e as { code?: string; message?: string; detail?: string; hint?: string }
  const code = err.code ?? 'XX000'
  const status = code === '42501' ? 403 : code === '23505' || code === '23503' ? 409 : code === 'P0002' ? 404 : 400
  console.warn('[검증 모드]', code, err.message)
  return json({ code, message: err.message ?? '검증 DB 오류', details: err.detail ?? null, hint: err.hint ?? null }, status)
}

/** 식별자(테이블·컬럼·함수 이름)는 영문 소문자·숫자·_ 만 */
function ident(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new ApiError(400, 'PGRST100', `잘못된 이름: ${name}`)
  return name
}

const q = (name: string) => `"${ident(name)}"`

// ── 테이블 메타 (컬럼 타입: 값을 넣을 때 형 변환) ──

const columnCache = new Map<string, Map<string, string>>()

async function columnTypes(tx: Transaction, tableName: string) {
  let cols = columnCache.get(tableName)
  if (!cols) {
    const { rows } = await tx.query<{ name: string; type: string }>(
      `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type
       from pg_attribute a where a.attrelid = ('public.' || $1)::regclass and a.attnum > 0 and not a.attisdropped`,
      [tableName],
    )
    cols = new Map(rows.map((r) => [r.name, r.type]))
    columnCache.set(tableName, cols)
  }
  return cols
}

/** JS 값 → SQL 매개변수 (배열은 Postgres 배열 문자열, json 은 JSON 문자열) */
function toParam(value: unknown, type: string): string | null {
  if (value === null || value === undefined) return null
  if (type.endsWith('[]') && Array.isArray(value)) {
    return `{${value.map((v) => (v === null ? 'NULL' : `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)).join(',')}}`
  }
  if (type === 'json' || type === 'jsonb') return JSON.stringify(value)
  return String(value)
}

// ── select 문자열 → SQL ──

type SelectNode = { kind: 'col'; name: string; alias?: string } | { kind: 'embed'; alias: string; table: string; children: SelectNode[] }

function parseSelect(input: string): SelectNode[] {
  const nodes: SelectNode[] = []
  let i = 0
  const readUntil = (stops: string) => {
    let s = ''
    while (i < input.length && !stops.includes(input[i])) s += input[i++]
    return s.trim()
  }
  const parseList = (): SelectNode[] => {
    const list: SelectNode[] = []
    while (i < input.length && input[i] !== ')') {
      const token = readUntil(',()')
      if (input[i] === '(') {
        i++ // (
        const children = parseList()
        i++ // )
        const [alias, rawTable] = token.includes(':') ? token.split(':') : [token, token]
        const tableName = rawTable.split('!')[0]
        list.push({ kind: 'embed', alias: alias.trim(), table: tableName.trim(), children })
      } else if (token) {
        const [alias, rawCol] = token.includes(':') ? token.split(':') : [undefined, token]
        list.push({ kind: 'col', name: rawCol.split('::')[0].trim(), alias: alias?.trim() })
      }
      if (input[i] === ',') i++
    }
    return list
  }
  nodes.push(...parseList())
  return nodes
}

/** 앱이 쓰는 관계 (외래 키). one: 이 행이 가리키는 한 행, many: 이 행을 가리키는 여러 행 */
const RELATIONS: Record<string, Record<string, { kind: 'one' | 'many'; fk: string }>> = {
  academy_members: { academies: { kind: 'one', fk: 'academy_id' } },
  students: { academies: { kind: 'one', fk: 'academy_id' } },
  classes: { academies: { kind: 'one', fk: 'academy_id' }, class_schedules: { kind: 'many', fk: 'class_id' } },
  class_students: { students: { kind: 'one', fk: 'student_id' }, classes: { kind: 'one', fk: 'class_id' } },
  attendance: { students: { kind: 'one', fk: 'student_id' }, classes: { kind: 'one', fk: 'class_id' } },
  lesson_feedback: { students: { kind: 'one', fk: 'student_id' }, classes: { kind: 'one', fk: 'class_id' } },
}

let aliasSeq = 0

function selectList(tableName: string, nodes: SelectNode[], alias: string): string {
  if (nodes.length === 0) return `${alias}.*`
  return nodes
    .map((n) => {
      if (n.kind === 'col') return n.name === '*' ? `${alias}.*` : `${alias}.${q(n.name)} as ${q(n.alias ?? n.name)}`
      const rel = RELATIONS[tableName]?.[n.table]
      if (!rel) throw new ApiError(400, 'PGRST200', `관계를 찾을 수 없음: ${tableName} → ${n.table}`)
      const a = `e${++aliasSeq}`
      const inner = `select ${selectList(n.table, n.children, a)} from public.${q(n.table)} ${a}`
      return rel.kind === 'one'
        ? `(select to_jsonb(_e) from (${inner} where ${a}.id = ${alias}.${q(rel.fk)}) _e) as ${q(n.alias)}`
        : `coalesce((select jsonb_agg(to_jsonb(_e)) from (${inner} where ${a}.${q(rel.fk)} = ${alias}.id) _e), '[]'::jsonb) as ${q(n.alias)}`
    })
    .join(', ')
}

// ── 필터·정렬 ──

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function splitList(raw: string) {
  // in.(a,"b,c",d)
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of raw) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function whereClause(url: URL, alias: string, params: (string | null)[]) {
  const parts: string[] = []
  const p = (v: string | null) => {
    params.push(v)
    return `$${params.length}`
  }
  for (const [key, raw] of url.searchParams) {
    if (RESERVED.has(key)) continue
    const col = `${alias}.${q(key)}`
    let value = raw
    let negate = false
    if (value.startsWith('not.')) {
      negate = true
      value = value.slice(4)
    }
    const dot = value.indexOf('.')
    const op = value.slice(0, dot)
    const arg = value.slice(dot + 1)
    let cond: string
    switch (op) {
      case 'eq':
        cond = `${col} = ${p(arg)}`
        break
      case 'neq':
        cond = `${col} <> ${p(arg)}`
        break
      case 'gt':
        cond = `${col} > ${p(arg)}`
        break
      case 'gte':
        cond = `${col} >= ${p(arg)}`
        break
      case 'lt':
        cond = `${col} < ${p(arg)}`
        break
      case 'lte':
        cond = `${col} <= ${p(arg)}`
        break
      case 'like':
        cond = `${col}::text like ${p(arg.replace(/\*/g, '%'))}`
        break
      case 'ilike':
        cond = `${col}::text ilike ${p(arg.replace(/\*/g, '%'))}`
        break
      case 'is':
        if (!['null', 'true', 'false'].includes(arg)) throw new ApiError(400, 'PGRST100', `is.${arg}`)
        cond = `${col} is ${arg}`
        break
      case 'in': {
        const items = splitList(arg.replace(/^\(|\)$/g, ''))
        cond = items.length === 0 || (items.length === 1 && items[0] === '') ? 'false' : `${col} in (${items.map(p).join(', ')})`
        break
      }
      default:
        throw new ApiError(400, 'PGRST100', `지원하지 않는 필터: ${op}`)
    }
    parts.push(negate ? `not (${cond})` : cond)
  }
  return parts.length ? parts.join(' and ') : 'true'
}

function orderClause(url: URL, alias: string) {
  const raw = url.searchParams.get('order')
  if (!raw) return null
  return raw
    .split(',')
    .map((item) => {
      const [col, ...mods] = item.split('.')
      const dir = mods.includes('desc') ? 'desc' : 'asc'
      const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''
      return `${alias}.${q(col)} ${dir}${nulls}`
    })
    .join(', ')
}

function prefer(req: Request) {
  const raw = req.headers.get('Prefer') ?? ''
  return {
    representation: raw.includes('return=representation'),
    count: /count=(exact|planned|estimated)/.test(raw),
  }
}

/** 행 목록을 PostgREST 처럼 돌려준다 (단일 객체 요청이면 정확히 1행이어야 함) */
function respondRows(req: Request, rows: unknown[], status = 200, headers: Record<string, string> = {}) {
  if ((req.headers.get('Accept') ?? '').includes('vnd.pgrst.object')) {
    if (rows.length !== 1) {
      return json(
        {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
          details: `The result contains ${rows.length} rows`,
          hint: null,
        },
        406,
      )
    }
    return json(rows[0], status, headers)
  }
  return json(rows, status, headers)
}

// ── 테이블 요청 ──

async function table(tx: Transaction, req: Request, url: URL, tableName: string, body: string | null) {
  const nodes = parseSelect(url.searchParams.get('select') ?? '*')
  const pref = prefer(req)
  const params: (string | null)[] = []

  if (req.method === 'GET' || req.method === 'HEAD') {
    const where = whereClause(url, 't0', params)
    const order = orderClause(url, 't0')
    const limit = url.searchParams.get('limit')
    const offset = Number(url.searchParams.get('offset') ?? 0)
    let total: number | null = null
    if (pref.count) {
      const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from public.${q(tableName)} t0 where ${where}`, params)
      total = rows[0].n
      if (offset > 0 && offset >= total) {
        return json({ code: 'PGRST103', message: 'Requested range not satisfiable', details: null, hint: null }, 416)
      }
    }
    if (req.method === 'HEAD') {
      return new Response(null, { status: 200, headers: { 'Content-Range': `*/${total ?? '*'}` } })
    }
    const sql = `select coalesce(jsonb_agg(to_jsonb(_r) - '_n' order by _r._n), '[]'::jsonb) as data from (
      select ${selectList(tableName, nodes, 't0')}, row_number() over (${order ? `order by ${order}` : ''}) as _n
      from public.${q(tableName)} t0 where ${where}
      ${order ? `order by ${order}` : ''}
      ${limit ? `limit ${Number(limit)}` : ''} ${offset ? `offset ${offset}` : ''}
    ) _r`
    const rows = ((await tx.query<{ data: unknown[] }>(sql, params)).rows[0].data ?? []) as unknown[]
    const range = rows.length ? `${offset}-${offset + rows.length - 1}` : '*'
    return respondRows(req, rows, 200, { 'Content-Range': `${range}/${total ?? '*'}` })
  }

  const types = await columnTypes(tx, tableName)
  const returning = (cte: string) =>
    `select coalesce(jsonb_agg(to_jsonb(_r)), '[]'::jsonb) as data from (select ${selectList(tableName, nodes, 't0')} from ${cte} t0) _r`

  if (req.method === 'POST') {
    const input = JSON.parse(body ?? '[]') as Record<string, unknown> | Record<string, unknown>[]
    const list = Array.isArray(input) ? input : [input]
    if (list.length === 0) return pref.representation ? json([], 201) : new Response(null, { status: 201 })
    const cols = [...new Set(list.flatMap((r) => Object.keys(r)))].map(ident)
    const values = list
      .map(
        (r) =>
          `(${cols
            .map((c) => {
              if (!(c in r)) return 'default'
              params.push(toParam(r[c], types.get(c) ?? 'text'))
              return `$${params.length}::${types.get(c) ?? 'text'}`
            })
            .join(', ')})`,
      )
      .join(', ')
    const insert = `insert into public.${q(tableName)} (${cols.map(q).join(', ')}) values ${values}`
    if (!pref.representation) {
      await tx.query(insert, params)
      return new Response(null, { status: 201 })
    }
    const rows = (await tx.query<{ data: unknown[] }>(`with _w as (${insert} returning *) ${returning('_w')}`, params)).rows[0].data
    return respondRows(req, rows, 201)
  }

  if (req.method === 'PATCH') {
    const input = JSON.parse(body ?? '{}') as Record<string, unknown>
    const sets = Object.keys(input)
      .map(ident)
      .map((c) => {
        params.push(toParam(input[c], types.get(c) ?? 'text'))
        return `${q(c)} = $${params.length}::${types.get(c) ?? 'text'}`
      })
    if (sets.length === 0) return json([], 200)
    const where = whereClause(url, 't0', params)
    const update = `update public.${q(tableName)} as t0 set ${sets.join(', ')} where ${where}`
    if (!pref.representation) {
      await tx.query(update, params)
      return new Response(null, { status: 204 })
    }
    const rows = (await tx.query<{ data: unknown[] }>(`with _w as (${update} returning t0.*) ${returning('_w')}`, params)).rows[0].data
    return respondRows(req, rows)
  }

  if (req.method === 'DELETE') {
    const where = whereClause(url, 't0', params)
    const del = `delete from public.${q(tableName)} as t0 where ${where}`
    if (!pref.representation) {
      await tx.query(del, params)
      return new Response(null, { status: 204 })
    }
    const rows = (await tx.query<{ data: unknown[] }>(`with _w as (${del} returning t0.*) ${returning('_w')}`, params)).rows[0].data
    return respondRows(req, rows)
  }

  throw new ApiError(405, 'PGRST000', `지원하지 않는 요청: ${req.method}`)
}

// ── RPC ──

type FnInfo = { args: { name: string; type: string }[]; set: boolean; composite: boolean; void: boolean }
const fnCache = new Map<string, FnInfo>()

async function fnInfo(tx: Transaction, name: string): Promise<FnInfo> {
  const cached = fnCache.get(name)
  if (cached) return cached
  const { rows } = await tx.query<{
    names: string[] | null
    modes: string[] | null
    types: string[]
    retset: boolean
    typtype: string
    typname: string
  }>(
    `select p.proargnames as names, p.proargmodes::text[] as modes,
       array(select format_type(t, null) from unnest(p.proallargtypes) t) as types,
       array(select format_type(t, null) from unnest(p.proargtypes) t) as in_types,
       p.proretset as retset, rt.typtype::text as typtype, rt.typname::text as typname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
     where n.nspname = 'public' and p.proname = $1 limit 1`,
    [name],
  )
  const row = rows[0] as (typeof rows)[number] & { in_types: string[] }
  if (!row) throw new ApiError(404, 'PGRST202', `Could not find the function public.${name}`)
  const names = row.names ?? []
  const modes = row.modes
  const allTypes = modes ? row.types : row.in_types
  const args = names
    .map((n, i) => ({ name: n, type: allTypes[i], mode: modes ? modes[i] : 'i' }))
    .filter((a) => a.mode === 'i' || a.mode === 'b')
    .map(({ name: n, type }) => ({ name: n, type }))
  const info: FnInfo = {
    args,
    set: row.retset,
    composite: row.typtype === 'c' || row.typname === 'record',
    void: row.typname === 'void',
  }
  fnCache.set(name, info)
  return info
}

async function rpc(tx: Transaction, name: string, body: string | null) {
  const info = await fnInfo(tx, name)
  const input = body ? (JSON.parse(body) as Record<string, unknown>) : {}
  const params: (string | null)[] = []
  const argSql = Object.keys(input)
    .map((key) => {
      const arg = info.args.find((a) => a.name === key)
      if (!arg) throw new ApiError(404, 'PGRST202', `Could not find the function public.${name}(${key})`)
      params.push(toParam(input[key], arg.type))
      return `${q(key)} => $${params.length}::${arg.type}`
    })
    .join(', ')
  const call = `public.${q(name)}(${argSql})`

  if (info.void) {
    await tx.query(`select ${call}`, params)
    return json(null)
  }
  if (info.set || info.composite) {
    const { rows } = await tx.query<{ data: unknown[] }>(
      `select coalesce(jsonb_agg(to_jsonb(_r)), '[]'::jsonb) as data from ${call} _r`,
      params,
    )
    const data = rows[0].data
    return json(info.set ? data : (data[0] ?? null))
  }
  const { rows } = await tx.query<{ data: unknown }>(`select to_jsonb(${call}) as data`, params)
  return json(rows[0].data)
}

// ── Edge Function 흉내 ──

function edgeFunction(name: string, body: string | null) {
  const input = body ? (JSON.parse(body) as Record<string, string>) : {}
  if (name === 'phone-verify') {
    // 검증 모드에서는 문자를 보내지 않는다. 인증번호는 항상 123456
    if (input.action === 'send') return json({ ok: true, expiresIn: 180, resendAfter: 60 })
    if (input.action === 'verify') {
      return json(input.code === '123456' ? { ok: true } : { ok: false, error: '검증 모드 인증번호는 123456 이에요.' })
    }
  }
  return json({ error: `검증 모드에서는 ${name} 기능을 쓸 수 없어요.` }, 400)
}
