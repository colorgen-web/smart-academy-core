import { NotebookPen, PenLine } from 'lucide-react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'

import { PostRow, PostRowSkeleton } from '@/components/board/PostRow'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { fetchAcademy, fetchMyMembership } from '@/lib/academies'
import { BOARD_PAGE_SIZE, fetchBoardAuthors, fetchBoardPage, type PostCategory } from '@/lib/academyBoard'
import { cn } from '@/lib/utils'

const TABS: { key: PostCategory | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'notice', label: '공지' },
  { key: 'general', label: '게시글' },
]

/** 학원 공지·게시판 목록: 20개씩, 고정 공지 먼저. ?tab=notice|general&page=N */
export function AcademyBoardPage({ userId }: { userId: string }) {
  const academyId = Number(useParams().id)
  const [params] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'all') as PostCategory | 'all'
  const raw = Number(params.get('page') ?? '1')
  const page = Number.isInteger(raw) && raw >= 1 ? raw : 1
  const category = tab === 'all' ? undefined : tab

  const meta = useAsync(async () => {
    const [academy, membership] = await Promise.all([fetchAcademy(academyId), fetchMyMembership(academyId, userId)])
    return { academy, membership }
  }, [academyId, userId])
  const list = useAsync(async () => {
    const [board, authors] = await Promise.all([
      fetchBoardPage(academyId, page, category),
      fetchBoardAuthors(academyId),
    ])
    return { ...board, authors }
  }, [academyId, page, category])

  const href = (next: { tab?: string; page?: number }) => {
    const q = new URLSearchParams()
    const t = next.tab ?? tab
    if (t !== 'all') q.set('tab', t)
    if ((next.page ?? 1) > 1) q.set('page', String(next.page))
    const s = q.toString()
    return `/academies/${academyId}/board${s ? `?${s}` : ''}`
  }

  if (list.data?.outOfRange) return <Navigate to={href({})} replace />

  const membership = meta.data?.membership
  const canWrite = membership?.status === 'approved' && meta.data?.academy?.status === 'approved'
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / BOARD_PAGE_SIZE)) : 1

  return (
    <div>
      <PageHeader
        title="공지·게시판"
        backTo={`/academies/${academyId}`}
        action={
          canWrite && (
            <Button asChild size="sm">
              <Link to={`/academies/${academyId}/board/new`}>
                <PenLine data-icon="inline-start" />
                글쓰기
              </Link>
            </Button>
          )
        }
      />
      {meta.data?.academy && <p className="-mt-2 mb-4 text-sm text-muted-foreground">{meta.data.academy.name}</p>}

      <div role="tablist" aria-label="글 종류" className="mb-3 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            to={href({ tab: t.key })}
            replace
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              tab === t.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {list.loading ? (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {Array.from({ length: 5 }, (_, i) => (
              <PostRowSkeleton key={i} />
            ))}
          </ul>
        </Card>
      ) : list.error ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm">
          <p className="text-destructive">글을 불러오지 못했어요.</p>
          <button type="button" onClick={list.reload} className="text-muted-foreground underline underline-offset-4">
            다시 시도
          </button>
        </div>
      ) : list.data && list.data.items.length > 0 ? (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {list.data.items.map((post) => (
              <PostRow key={post.id} post={post} authors={list.data!.authors} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          icon={NotebookPen}
          title={tab === 'notice' ? '아직 공지가 없어요' : '아직 글이 없어요'}
          description={canWrite ? '첫 글을 남겨 보세요.' : undefined}
        />
      )}

      <div className="mt-5">
        <Pagination page={page} totalPages={totalPages} href={(n) => href({ page: n })} />
      </div>
    </div>
  )
}
