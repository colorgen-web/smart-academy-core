import { supabase } from '@/lib/supabase'

export type AcademyRole = 'director' | 'teacher' | 'parent' | 'student'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type Academy = {
  id: number
  name: string
  phone: string | null
  address: string | null
  status: ApprovalStatus
  join_code: string
  owner_id: string
  review_note: string | null
  created_at: string
}

export type MyAcademy = {
  role: AcademyRole
  status: ApprovalStatus
  academy: Pick<Academy, 'id' | 'name' | 'status'>
}

export type AcademyMember = {
  user_id: string
  name: string
  phone: string
  role: AcademyRole
  status: ApprovalStatus
  requested_at: string
  decided_at: string | null
}

export type AcademyForReview = Academy & { owner: { name: string; phone: string } | null }

export const ROLE_LABEL: Record<AcademyRole, string> = {
  director: '원장',
  teacher: '강사',
  parent: '학부모',
  student: '학생',
}

export const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '거절됨',
}

/** 가입 신청으로 고를 수 있는 역할 (원장은 학원 등록으로만) */
export const JOINABLE_ROLES: AcademyRole[] = ['teacher', 'parent', 'student']

function db() {
  if (!supabase) throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  return supabase
}

/** DB 함수가 보낸 한국어 안내(권한·코드 오류 등)는 그대로, 그 밖의 오류는 fallback 으로 */
export function errorMessage(error: unknown, fallback: string) {
  const e = error as { code?: string; message?: string } | null
  const userFacing = ['42501', 'P0001', 'P0002', '23505', '22023']
  return e?.code && userFacing.includes(e.code) && e.message && /[가-힣]/.test(e.message) ? e.message : fallback
}

export async function fetchMyAcademies(userId: string): Promise<MyAcademy[]> {
  const { data, error } = await db()
    .from('academy_members')
    .select('role, status, academy:academies(id, name, status)')
    .eq('user_id', userId)
    .order('requested_at', { ascending: true })
  if (error) throw error
  return data as unknown as MyAcademy[]
}

export async function fetchAcademy(id: number): Promise<Academy | null> {
  const { data, error } = await db()
    .from('academies')
    .select('id, name, phone, address, status, join_code, owner_id, review_note, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Academy | null
}

export async function fetchMyMembership(academyId: number, userId: string) {
  const { data, error } = await db()
    .from('academy_members')
    .select('role, status')
    .eq('academy_id', academyId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as { role: AcademyRole; status: ApprovalStatus } | null
}

export async function registerAcademy(input: { name: string; phone?: string; address?: string }) {
  const { data, error } = await db().rpc('register_academy', {
    p_name: input.name,
    p_phone: input.phone || null,
    p_address: input.address || null,
  })
  if (error) throw error
  return data as number
}

export async function findAcademyByCode(code: string) {
  const { data, error } = await db().rpc('find_academy_by_code', { p_code: code })
  if (error) throw error
  return ((data as { id: number; name: string }[]) ?? [])[0] ?? null
}

export async function requestAcademyJoin(code: string, role: AcademyRole) {
  const { data, error } = await db().rpc('request_academy_join', { p_code: code, p_role: role })
  if (error) throw error
  return data as number
}

export async function fetchAcademyMembers(academyId: number): Promise<AcademyMember[]> {
  const { data, error } = await db().rpc('academy_member_list', { p_academy_id: academyId })
  if (error) throw error
  return (data as AcademyMember[]) ?? []
}

export async function decideAcademyMember(academyId: number, userId: string, approve: boolean) {
  const { error } = await db().rpc('decide_academy_member', {
    p_academy_id: academyId,
    p_user_id: userId,
    p_approve: approve,
  })
  if (error) throw error
}

export async function regenerateJoinCode(academyId: number) {
  const { data, error } = await db().rpc('regenerate_join_code', { p_academy_id: academyId })
  if (error) throw error
  return data as string
}

/** 운영자: 상태별 학원 목록 + 등록한 원장 이름·연락처 */
export async function fetchAcademiesForReview(status: ApprovalStatus): Promise<AcademyForReview[]> {
  const { data, error } = await db()
    .from('academies')
    .select('id, name, phone, address, status, join_code, owner_id, review_note, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  const academies = data as Academy[]
  const ownerIds = [...new Set(academies.map((a) => a.owner_id))]
  if (ownerIds.length === 0) return []
  const { data: owners, error: ownerError } = await db()
    .from('profiles')
    .select('id, name, phone')
    .in('id', ownerIds)
  if (ownerError) throw ownerError
  const byId = new Map((owners ?? []).map((o) => [o.id as string, { name: o.name as string, phone: o.phone as string }]))
  return academies.map((a) => ({ ...a, owner: byId.get(a.owner_id) ?? null }))
}

export async function reviewAcademy(academyId: number, approve: boolean, note?: string) {
  const { error } = await db().rpc('review_academy', {
    p_academy_id: academyId,
    p_approve: approve,
    p_note: note || null,
  })
  if (error) throw error
}

/** 학원 전화번호 표시: 021234567 → 02-123-4567, 0311234567 → 031-123-4567 */
export function formatAcademyPhone(digits: string | null) {
  if (!digits) return null
  if (digits.startsWith('02')) {
    const rest = digits.slice(2)
    return `02-${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`
}
