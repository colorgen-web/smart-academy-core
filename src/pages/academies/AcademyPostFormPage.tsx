import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Field } from '@/components/Field'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage, fetchAcademy, fetchMyMembership, ROLE_LABEL } from '@/lib/academies'
import {
  AUDIENCE_ROLES,
  CATEGORY_LABEL,
  fetchPost,
  savePost,
  type AcademyPost,
  type PostAudience,
  type PostCategory,
} from '@/lib/academyBoard'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

/** 학원 글쓰기 (/academies/:id/board/new) · 고치기 (/academy-posts/:postId/edit). 권한은 DB 함수가 다시 확인한다 */
export function AcademyPostFormPage({ userId }: { userId: string }) {
  const params = useParams()
  const navigate = useNavigate()
  const editId = params.postId ? Number(params.postId) : undefined

  const ctx = useAsync(async () => {
    const post = editId ? await fetchPost(editId) : null
    const academyId = post?.academy_id ?? Number(params.id)
    const [academy, membership] = await Promise.all([fetchAcademy(academyId), fetchMyMembership(academyId, userId)])
    return { academyId, academy, membership, post }
  }, [editId, params.id, userId])

  const role = ctx.data?.membership?.status === 'approved' ? ctx.data.membership.role : null
  const backTo = editId ? `/academy-posts/${editId}` : `/academies/${params.id}/board`
  const header = <PageHeader title={editId ? '글 고치기' : '글쓰기'} backTo={backTo} />

  if (ctx.loading) return header
  if (ctx.error || !ctx.data?.academy || !role || (editId && ctx.data.post?.author_id !== userId)) {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-semibold">
            {ctx.error
              ? '불러오지 못했어요.'
              : editId
                ? '본인이 쓴 글만 고칠 수 있어요.'
                : '이 학원의 승인된 회원만 글을 쓸 수 있어요.'}
          </p>
          <Button variant="outline" asChild>
            <Link to={backTo}>돌아가기</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{ctx.data.academy.name}</p>
      <PostForm
        academyId={ctx.data.academyId}
        post={ctx.data.post}
        isStaff={role === 'director' || role === 'teacher'}
        onSaved={(id) => navigate(`/academy-posts/${id}`, { replace: true })}
      />
    </div>
  )
}

function PostForm({
  academyId,
  post,
  isStaff,
  onSaved,
}: {
  academyId: number
  post: AcademyPost | null
  isStaff: boolean
  onSaved: (id: number) => void
}) {
  // 새 글: 원장·강사는 공지가 기본
  const [category, setCategory] = useState<PostCategory>(post?.category ?? (isStaff ? 'notice' : 'general'))
  const [title, setTitle] = useState(post?.title ?? '')
  const [content, setContent] = useState(post?.content ?? '')
  const [pinned, setPinned] = useState(post?.is_pinned ?? false)
  const [audience, setAudience] = useState<Set<PostAudience>>(new Set(post?.audience ?? AUDIENCE_ROLES))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleAudience = (r: PostAudience) =>
    setAudience((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })

  const isNotice = category === 'notice'
  const valid = title.trim() && (!isNotice || audience.size > 0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const id = await savePost(
        academyId,
        { category, title: title.trim(), content: content.trim(), pinned: isNotice && pinned, audience: [...audience] },
        post?.id,
      )
      onSaved(id)
    } catch (err) {
      setError(errorMessage(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isStaff && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">종류</span>
              <div role="radiogroup" aria-label="종류" className="grid grid-cols-2 gap-2">
                {(['notice', 'general'] as PostCategory[]).map((c) => (
                  <ChoiceButton key={c} selected={category === c} onClick={() => setCategory(c)} role="radio">
                    {CATEGORY_LABEL[c]}
                  </ChoiceButton>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {isNotice ? '공지는 고른 대상에게 알림이 가요.' : '게시글은 소속 회원 모두가 보고, 알림은 가지 않아요.'}
              </span>
            </div>
          )}

          {isNotice && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">볼 사람</span>
              <div role="group" aria-label="볼 사람" className="grid grid-cols-3 gap-2">
                {AUDIENCE_ROLES.map((r) => (
                  <ChoiceButton key={r} selected={audience.has(r)} onClick={() => toggleAudience(r)}>
                    {ROLE_LABEL[r]}
                  </ChoiceButton>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">원장은 항상 볼 수 있어요.</span>
            </div>
          )}

          <Field label="제목">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder={isNotice ? '추석 연휴 휴원 안내' : '제목'}
              className={inputClass}
              autoFocus={!post}
            />
          </Field>
          <Field label="내용">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
              rows={10}
              className={cn(inputClass, 'h-auto resize-y py-2')}
            />
          </Field>

          {isNotice && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="size-4 accent-primary"
              />
              목록 맨 위에 고정
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="h-11" disabled={saving || !valid}>
            {saving ? '저장 중…' : post ? '저장' : '올리기'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ChoiceButton({
  selected,
  onClick,
  role,
  children,
}: {
  selected: boolean
  onClick: () => void
  role?: 'radio'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role={role}
      aria-pressed={role ? undefined : selected}
      aria-checked={role ? selected : undefined}
      onClick={onClick}
      className={cn(
        'h-10 rounded-lg border text-sm font-medium transition-colors',
        selected ? 'border-primary bg-accent text-accent-foreground ring-1 ring-primary' : 'hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}
