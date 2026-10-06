import { supabase } from '@/lib/supabase'

function db() {
  if (!supabase) throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  return supabase
}

/** 탈퇴를 막는 이유 (비어 있으면 탈퇴 가능) */
export async function fetchDeletionBlockers(): Promise<string[]> {
  const { data, error } = await db().rpc('account_deletion_blockers')
  if (error) throw error
  return ((data as { reason: string }[]) ?? []).map((r) => r.reason)
}

/** 계정과 개인정보를 지우고, 이 기기의 로그인도 정리한다 */
export async function deleteMyAccount() {
  const client = db()
  const { error } = await client.rpc('delete_my_account')
  if (error) throw error
  // 서버의 계정이 이미 지워졌으므로 이 기기에 남은 세션만 지운다 (+ 이전 버전이 남긴 값 정리)
  await client.auth.signOut({ scope: 'local' })
  try {
    localStorage.removeItem('academy_login_provider')
  } catch {
    // 무시
  }
}
