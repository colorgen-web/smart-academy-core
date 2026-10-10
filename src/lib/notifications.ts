import { supabase } from '@/lib/supabase'

export type NotificationType =
  | 'attendance'
  | 'join_request'
  | 'membership'
  | 'academy_request'
  | 'academy_review'
  | 'academy_message'
  | 'member_left'
  | 'lesson_feedback'

export type AppNotification = {
  id: number
  academy_id: number | null
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export const NOTIFICATION_PAGE = 20

function db() {
  if (!supabase) throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  return supabase
}

/** 최신순. offset 부터 NOTIFICATION_PAGE 개 */
export async function fetchNotifications(offset = 0): Promise<AppNotification[]> {
  const { data, error } = await db()
    .from('notifications')
    .select('id, academy_id, type, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + NOTIFICATION_PAGE - 1)
  if (error) throw error
  return data as AppNotification[]
}

export async function fetchUnreadCount() {
  const { count, error } = await db()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id: number) {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const { error } = await db()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
}

export async function deleteNotification(id: number) {
  const { error } = await db().from('notifications').delete().eq('id', id)
  if (error) throw error
}

/** 원장: 학원 소속 회원에게 알림 보내기. 받은 사람 수를 돌려준다 */
export async function sendAcademyMessage(
  academyId: number,
  title: string,
  body: string,
  roles: ('teacher' | 'parent' | 'student')[],
) {
  const { data, error } = await db().rpc('send_academy_message', {
    p_academy_id: academyId,
    p_title: title,
    p_body: body,
    p_roles: roles,
  })
  if (error) throw error
  return data as number
}
