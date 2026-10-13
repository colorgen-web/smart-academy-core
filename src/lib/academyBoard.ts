import { ROLE_LABEL, type AcademyRole } from '@/lib/academies'
import { supabase } from '@/lib/supabase'

/** 학원 공지·게시판. 볼 수 있는 글은 RLS 가 거르고, 쓰기는 save_academy_post() 가 권한을 확인한다. */

export type PostCategory = 'notice' | 'general'
/** 공지를 볼 역할 (원장은 항상 본다) */
export type PostAudience = Exclude<AcademyRole, 'director'>

export const CATEGORY_LABEL: Record<PostCategory, string> = { notice: '공지', general: '게시글' }
export const AUDIENCE_ROLES: PostAudience[] = ['teacher', 'parent', 'student']

export type AcademyPostSummary = {
  id: number
  academy_id: number
  category: PostCategory
  title: string
  is_pinned: boolean
  audience: PostAudience[]
  author_id: string | null
  created_at: string
  comments: { count: number }[]
}

export type AcademyPost = Omit<AcademyPostSummary, 'comments'> & { content: string; updated_at: string }

export type PostComment = { id: number; post_id: number; content: string; author_id: string | null; created_at: string }

export type BoardAuthor = { name: string; role: AcademyRole | null }

export const BOARD_PAGE_SIZE = 20

const LIST_COLUMNS =
  'id, academy_id, category, title, is_pinned, audience, author_id, created_at, comments:academy_post_comments(count)'
const DETAIL_COLUMNS =
  'id, academy_id, category, title, content, is_pinned, audience, author_id, created_at, updated_at'

function db() {
  if (!supabase) throw new Error('Supabase 설정이 없어요. .env 파일을 확인해 주세요.')
  return supabase
}

/** page 는 1부터. 고정 공지 먼저, 그다음 최신순 */
export async function fetchBoardPage(academyId: number, page: number, category?: PostCategory) {
  const from = (page - 1) * BOARD_PAGE_SIZE
  let query = db().from('academy_posts').select(LIST_COLUMNS, { count: 'exact' }).eq('academy_id', academyId)
  if (category) query = query.eq('category', category)
  const { data, error, count } = await query
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + BOARD_PAGE_SIZE - 1)
  if (error?.code === 'PGRST103') return { items: [] as AcademyPostSummary[], total: 0, outOfRange: true }
  if (error) throw error
  return { items: data as unknown as AcademyPostSummary[], total: count ?? 0, outOfRange: false }
}

/** 홈 화면: 내 학원들의 최근 공지 */
export async function fetchLatestAcademyNotices(limit = 3) {
  const { data, error } = await db()
    .from('academy_posts')
    .select('id, title, is_pinned, created_at, academy:academies(name)')
    .eq('category', 'notice')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as unknown as {
    id: number
    title: string
    is_pinned: boolean
    created_at: string
    academy: { name: string } | null
  }[]
}

export async function fetchPost(id: number): Promise<AcademyPost | null> {
  const { data, error } = await db().from('academy_posts').select(DETAIL_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data as AcademyPost | null
}

export async function fetchComments(postId: number): Promise<PostComment[]> {
  const { data, error } = await db()
    .from('academy_post_comments')
    .select('id, post_id, content, author_id, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data as PostComment[]
}

/** 글·댓글 작성자 이름과 학원 역할. 탈퇴한 작성자는 빠진다 */
export async function fetchBoardAuthors(academyId: number) {
  const { data, error } = await db().rpc('academy_board_authors', { p_academy_id: academyId })
  if (error) throw error
  return new Map(
    ((data as { user_id: string; name: string; role: AcademyRole | null }[]) ?? []).map((a) => [
      a.user_id,
      { name: a.name, role: a.role } satisfies BoardAuthor,
    ]),
  )
}

export type PostInput = {
  category: PostCategory
  title: string
  content: string
  pinned: boolean
  audience: PostAudience[]
}

/** 새 글(id 없음) 또는 본인 글 고치기. 글 id 를 돌려준다 */
export async function savePost(academyId: number, input: PostInput, id?: number) {
  const { data, error } = await db().rpc('save_academy_post', {
    p_id: id ?? null,
    p_academy_id: academyId,
    p_category: input.category,
    p_title: input.title,
    p_content: input.content,
    p_pinned: input.pinned,
    p_audience: input.audience,
  })
  if (error) throw error
  return data as number
}

export async function deletePost(id: number) {
  const { data, error } = await db().from('academy_posts').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('지울 수 없는 글이에요.')
}

export async function addComment(postId: number, content: string) {
  const { error } = await db().from('academy_post_comments').insert({ post_id: postId, content })
  if (error) throw error
}

export async function deleteComment(id: number) {
  const { data, error } = await db().from('academy_post_comments').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('지울 수 없는 댓글이에요.')
}

/** "김원장 (원장)" / 탈퇴한 회원 */
export function authorLabel(authorId: string | null, authors: Map<string, BoardAuthor> | undefined) {
  const a = authorId ? authors?.get(authorId) : undefined
  if (!a) return authorId ? '회원' : '탈퇴한 회원'
  return a.role ? `${a.name} (${ROLE_LABEL[a.role]})` : a.name
}

/** 공지 대상 표시: 모두에게면 null, 아니면 "학부모·학생" */
export function audienceLabel(audience: PostAudience[]) {
  if (AUDIENCE_ROLES.every((r) => audience.includes(r))) return null
  return AUDIENCE_ROLES.filter((r) => audience.includes(r))
    .map((r) => ROLE_LABEL[r])
    .join('·')
}
