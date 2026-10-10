import { useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'

/**
 * 검증 모드 (운영자 전용)
 * 켜면 Supabase 대신 이 브라우저 안의 데이터베이스(PGlite, IndexedDB 저장)를 쓴다.
 * 실제 DB 와 같은 마이그레이션(테이블·권한·함수·트리거)을 그대로 적용하므로, 실제 데이터를 건드리지 않고
 * 역할을 바꿔 가며 가입 → 승인 → 반 → 출석 → 이해도 → 알림 흐름을 확인할 수 있다.
 *
 * 켜고 끈 상태와 고른 역할은 localStorage 에, 검증 데이터는 IndexedDB 에 남는다 (이 기기·이 브라우저에만).
 * 실제 운영자 계정으로 로그인해 있을 때만 동작한다 (App 이 확인 후 setVerifyRuntime 으로 알려 준다).
 */

export type PersonaKey = 'admin' | 'director' | 'teacher' | 'parent' | 'student' | 'parent2' | 'newbie'

export type Persona = {
  key: PersonaKey
  id: string
  /** 화면에 보일 역할 이름 */
  role: string
  name: string
  phone: string
  provider: 'kakao' | 'naver'
  admin?: boolean
  /** 가입 전 회원 (회원가입 화면부터) */
  signup?: boolean
}

export const PERSONAS: Persona[] = [
  { key: 'admin', id: 'a0000000-0000-4000-8000-000000000001', role: '운영자', name: '운영자', phone: '01090000001', provider: 'kakao', admin: true },
  { key: 'director', id: 'a0000000-0000-4000-8000-000000000002', role: '원장', name: '김원장', phone: '01090000002', provider: 'kakao' },
  { key: 'teacher', id: 'a0000000-0000-4000-8000-000000000003', role: '강사', name: '박선생', phone: '01090000003', provider: 'naver' },
  { key: 'parent', id: 'a0000000-0000-4000-8000-000000000004', role: '학부모', name: '이엄마', phone: '01090000004', provider: 'naver' },
  { key: 'student', id: 'a0000000-0000-4000-8000-000000000005', role: '학생', name: '이민준', phone: '01090000005', provider: 'kakao' },
  { key: 'parent2', id: 'a0000000-0000-4000-8000-000000000006', role: '학부모 (가입 대기)', name: '최아빠', phone: '01090000006', provider: 'kakao' },
  { key: 'newbie', id: 'a0000000-0000-4000-8000-000000000007', role: '신규 회원 (가입 전)', name: '정신규', phone: '01090000007', provider: 'naver', signup: true },
]

export function personaOf(key: PersonaKey) {
  return PERSONAS.find((p) => p.key === key) ?? PERSONAS[0]
}

/** 화면이 쓰는 로그인 사용자 모양으로 (Supabase User 의 필요한 부분만) */
export function personaUser(p: Persona): User {
  return {
    id: p.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${p.key}@verify.local`,
    app_metadata: { provider: p.provider, ...(p.provider === 'naver' ? { naver_id: p.key } : {}), ...(p.admin ? { role: 'admin' } : {}) },
    user_metadata: { name: p.name },
    created_at: '2026-01-01T00:00:00Z',
  } as User
}

// ── 저장된 설정 (켜짐 여부·고른 역할) ──

const STORAGE_KEY = 'academy_verify_mode'

type Stored = { on: boolean; persona: PersonaKey }

function read(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const v = JSON.parse(raw) as Stored
      if (PERSONAS.some((p) => p.key === v.persona)) return { on: !!v.on, persona: v.persona }
    }
  } catch {
    // 저장소를 못 쓰면 꺼진 것으로
  }
  return { on: false, persona: 'admin' }
}

let stored = read()
const listeners = new Set<() => void>()

function write(next: Stored) {
  stored = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 이번 화면에서만 유지
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useVerifySetting() {
  return useSyncExternalStore(subscribe, () => stored)
}

export function startVerifyMode(persona: PersonaKey = 'admin') {
  write({ on: true, persona })
}

export function switchPersona(persona: PersonaKey) {
  write({ ...stored, persona })
}

export function stopVerifyMode() {
  write({ ...stored, on: false })
}

// ── 지금 요청을 검증 DB 로 보낼지 (App 이 운영자 확인 후 정한다) ──

let runtime: { active: boolean; persona: Persona } = { active: false, persona: PERSONAS[0] }

/** App 이 렌더할 때 호출한다. 실제 운영자로 로그인해 있고 검증 모드가 켜져 있을 때만 active */
export function setVerifyRuntime(active: boolean, persona: PersonaKey) {
  runtime = { active, persona: personaOf(persona) }
}

export function verifyRuntime() {
  return runtime
}
