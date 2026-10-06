import type { User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

export type MemberType = 'parent' | 'student' | 'teacher' | 'director'
export type Provider = 'kakao' | 'naver'

export type Profile = {
  id: string
  name: string
  phone: string
  member_type: MemberType
  provider: Provider
  email: string | null
  created_at: string
}

export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  parent: '학부모',
  student: '학생',
  teacher: '강사',
  director: '원장',
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  kakao: '카카오',
  naver: '네이버',
}

const COLUMNS = 'id, name, phone, member_type, provider, email, created_at'

function db() {
  if (!supabase) throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  return supabase
}

/** 이 계정의 가입 방법. 네이버 계정은 Edge Function 이 app_metadata.naver_id 를 넣어 둔다 */
export function accountProvider(user: User): Provider {
  return user.app_metadata.naver_id ? 'naver' : 'kakao'
}

/** 소셜 계정에서 받은 이름·사진 (회원가입 기본값, 프로필 사진 표시용) */
export function socialInfo(user: User) {
  const meta = user.user_metadata
  return {
    name: (meta.name ?? meta.full_name ?? meta.nickname ?? '') as string,
    avatarUrl: meta.avatar_url as string | undefined,
  }
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function isValidPhone(digits: string) {
  return /^01[016789]\d{7,8}$/.test(digits)
}

/** 01012345678 → 010-1234-5678 (입력 중인 값도 처리) */
export function formatPhone(value: string) {
  const d = normalizePhone(value)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  const mid = d.length === 11 ? 4 : 3
  return `${d.slice(0, 3)}-${d.slice(3, 3 + mid)}-${d.slice(3 + mid)}`
}

/** 010-****-5678 */
export function maskPhone(digits: string) {
  const formatted = formatPhone(digits).split('-')
  if (formatted.length !== 3) return formatPhone(digits)
  return `${formatted[0]}-${'*'.repeat(formatted[1].length)}-${formatted[2]}`
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from('profiles').select(COLUMNS).eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

/** 이미 다른 계정이 쓰는 번호면 그 계정의 가입 방법, 아니면 null */
export async function phoneSignupProvider(digits: string): Promise<Provider | null> {
  const { data, error } = await db().rpc('phone_signup_provider', { p_phone: digits })
  if (error) throw error
  return (data as Provider | null) ?? null
}

export class PhoneTakenError extends Error {
  readonly provider: Provider | null

  constructor(provider: Provider | null) {
    super('이미 가입된 휴대폰 번호예요.')
    this.provider = provider
  }
}

export async function createProfile(input: {
  name: string
  phone: string
  member_type: MemberType
  over_14_confirmed: true
}): Promise<Profile> {
  const taken = await phoneSignupProvider(input.phone)
  if (taken) throw new PhoneTakenError(taken)

  const { data, error } = await db().from('profiles').insert(input).select(COLUMNS).single()
  if (error?.code === '23505') {
    // 확인과 저장 사이에 다른 계정이 같은 번호로 가입한 경우
    throw new PhoneTakenError(await phoneSignupProvider(input.phone).catch(() => null))
  }
  if (error) throw error
  return data as Profile
}
