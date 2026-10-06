import { supabase } from '@/lib/supabase'

/** 목록 한 줄에 필요한 정보 */
export type AnnouncementSummary = {
  id: number
  title: string
  is_pinned: boolean
  created_at: string
}

export type Announcement = AnnouncementSummary & { content: string }

/** 메인 화면에 보여줄 개수 */
export const HOME_LIMIT = 5
/** 전체 목록 한 페이지 개수 */
export const PAGE_SIZE = 10

// 목록에서는 본문을 받지 않는다 (상세에서만)
const LIST_COLUMNS = 'id, title, is_pinned, created_at'
const DETAIL_COLUMNS = 'id, title, content, is_pinned, created_at'

function db() {
  if (!supabase) throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  return supabase
}

function ordered(count?: 'exact') {
  return db()
    .from('announcements')
    .select(LIST_COLUMNS, count ? { count } : undefined)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
}

export async function fetchLatestAnnouncements(): Promise<AnnouncementSummary[]> {
  const { data, error } = await ordered().limit(HOME_LIMIT)
  if (error) throw error
  return data
}

/** page 는 1부터. total 은 전체 공지 수 */
export async function fetchAnnouncementPage(page: number) {
  const from = (page - 1) * PAGE_SIZE
  const { data, error, count } = await ordered('exact').range(from, from + PAGE_SIZE - 1)
  if (error?.code === 'PGRST103') {
    // 마지막 페이지를 넘어선 요청은 416 으로 온다 → 전체 수만 구해 화면에서 마지막 페이지로 보낸다
    const { count: total, error: countError } = await db()
      .from('announcements')
      .select('id', { count: 'exact', head: true })
    if (countError) throw countError
    return { items: [] as AnnouncementSummary[], total: total ?? 0 }
  }
  if (error) throw error
  return { items: data as AnnouncementSummary[], total: count ?? 0 }
}

export async function fetchAnnouncement(id: number): Promise<Announcement | null> {
  const { data, error } = await db().from('announcements').select(DETAIL_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createAnnouncement(input: Pick<Announcement, 'title' | 'content' | 'is_pinned'>) {
  const { data, error } = await db().from('announcements').insert(input).select('id').single()
  if (error) throw error
  return data.id as number
}

export async function deleteAnnouncement(id: number) {
  const { error } = await db().from('announcements').delete().eq('id', id)
  if (error) throw error
}

/** 2026.10.05 형식 */
export function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/** 작성 후 3일 이내면 새 글 */
export function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 3 * 24 * 60 * 60 * 1000
}
