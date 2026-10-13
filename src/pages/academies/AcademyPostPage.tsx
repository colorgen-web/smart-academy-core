import { Pencil, Pin, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage, fetchAcademy, fetchMyMembership } from '@/lib/academies'
import {
  addComment,
  audienceLabel,
  authorLabel,
  deleteComment,
  deletePost,
  fetchBoardAuthors,
  fetchComments,
  fetchPost,
} from '@/lib/academyBoard'
import { formatDate } from '@/lib/announcements'
import { formatRelative } from '@/lib/date'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

/** 학원 글 상세 + 댓글. 지우기는 본인 또는 그 학원 원장 */
export function AcademyPostPage({ userId }: { userId: string }) {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(async () => {
    const post = Number.isInteger(id) ? await fetchPost(id) : null
    if (!post) return null
    const [academy, membership, comments, authors] = await Promise.all([
      fetchAcademy(post.academy_id),
      fetchMyMembership(post.academy_id, userId),
      fetchComments(id),
      fetchBoardAuthors(post.academy_id),
    ])
    return { post, academy, membership, comments, authors }
  }, [id, userId])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const backTo = data ? `/academies/${data.post.academy_id}/board` : '/'
  const isDirector = data?.membership?.role === 'director' && data.membership.status === 'approved'

  const handleDeletePost = async () => {
    if (!data || !window.confirm('이 글을 지울까요? 댓글도 함께 지워져요.')) return
    setBusy(true)
    try {
      await deletePost(id)
      navigate(backTo, { replace: true })
    } catch (err) {
      window.alert(errorMessage(err, '지우지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setBusy(false)
    }
  }

  const handleComment = async (e: FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      await addComment(id, comment.trim())
      setComment('')
      reload()
    } catch (err) {
      setActionError(errorMessage(err, '댓글을 남기지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('이 댓글을 지울까요?')) return
    try {
      await deleteComment(commentId)
      reload()
    } catch (err) {
      window.alert(errorMessage(err, '지우지 못했어요.'))
    }
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="공지·게시판" backTo="/" />
        <Card>
          <CardContent className="flex flex-col gap-3" aria-hidden="true">
            <span className="h-6 w-3/4 animate-pulse rounded bg-muted" />
            <span className="h-4 w-24 animate-pulse rounded bg-muted" />
            <span className="mt-2 h-24 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="공지·게시판" backTo="/" />
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-semibold">{error ? '글을 불러오지 못했어요.' : '없거나 볼 수 없는 글이에요.'}</p>
          <Button variant="outline" asChild>
            <Link to="/">홈으로</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { post, academy, comments, authors } = data
  const mine = post.author_id === userId
  const audience = post.category === 'notice' ? audienceLabel(post.audience) : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="공지·게시판"
        backTo={backTo}
        action={
          <div className="flex gap-1.5">
            {mine && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/academy-posts/${post.id}/edit`}>
                  <Pencil data-icon="inline-start" />
                  고치기
                </Link>
              </Button>
            )}
            {(mine || isDirector) && (
              <Button variant="destructive" size="sm" onClick={handleDeletePost} disabled={busy}>
                <Trash2 data-icon="inline-start" />
                삭제
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent>
          <article className="flex flex-col gap-4">
            <header className="flex flex-col gap-2 border-b pb-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {post.category === 'notice' && (
                  <Badge className="gap-1">
                    {post.is_pinned && <Pin data-icon="inline-start" />}
                    {post.is_pinned ? '고정 공지' : '공지'}
                  </Badge>
                )}
                {audience && <Badge variant="outline">{audience}에게</Badge>}
                {academy && <span className="text-xs text-muted-foreground">{academy.name}</span>}
              </div>
              <h2 className="text-lg font-semibold leading-snug break-words">{post.title}</h2>
              <p className="text-sm text-muted-foreground">
                {authorLabel(post.author_id, authors)} ·{' '}
                <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
                {post.updated_at.slice(0, 16) !== post.created_at.slice(0, 16) && ' (수정됨)'}
              </p>
            </header>
            {post.content && (
              <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{post.content}</div>
            )}
          </article>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <h3 className="border-b px-4 py-3 font-semibold">
          댓글 <span className="tabular-nums text-muted-foreground">{comments.length}</span>
        </h3>
        {comments.length > 0 && (
          <ul className="divide-y">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        'truncate font-medium',
                        c.author_id === post.author_id && c.author_id && 'text-primary',
                      )}
                    >
                      {authorLabel(c.author_id, authors)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={c.created_at} className="shrink-0">
                      {formatRelative(c.created_at)}
                    </time>
                  </p>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{c.content}</p>
                </div>
                {(c.author_id === userId || isDirector) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(c.id)}
                    aria-label="댓글 지우기"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleComment} className="flex gap-2 border-t px-4 py-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={1}
            placeholder="댓글을 남겨 주세요"
            aria-label="댓글"
            className={cn(inputClass, 'h-auto min-h-11 flex-1 resize-y py-2.5')}
          />
          <Button type="submit" className="h-11" disabled={busy || !comment.trim()}>
            등록
          </Button>
        </form>
        {actionError && <p className="border-t px-4 py-2 text-sm text-destructive">{actionError}</p>}
      </Card>
    </div>
  )
}
