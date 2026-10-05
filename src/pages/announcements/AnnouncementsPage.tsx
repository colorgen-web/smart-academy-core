import { PenLine } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router'

import { AnnouncementRow, AnnouncementRowSkeleton } from '@/components/announcements/AnnouncementRow'
import { PageHeader } from '@/components/layout/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { fetchAnnouncementPage, PAGE_SIZE } from '@/lib/announcements'

/** 공지사항 전체 목록: 10개씩, ?page=N 으로 페이지 이동 */
export function AnnouncementsPage({ isAdmin }: { isAdmin: boolean }) {
  const [params] = useSearchParams()
  const raw = Number(params.get('page') ?? '1')
  const page = Number.isInteger(raw) && raw >= 1 ? raw : 1
  const { data, error, loading, reload } = useAsync(() => fetchAnnouncementPage(page), [page])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  // 공지가 지워져서 마지막 페이지를 넘어선 경우 마지막 페이지로
  if (data && page > totalPages) return <Navigate to={`/announcements?page=${totalPages}`} replace />

  return (
    <div>
      <PageHeader
        title="공지사항"
        backTo="/"
        action={
          isAdmin && (
            <Button asChild size="sm">
              <Link to="/announcements/new">
                <PenLine data-icon="inline-start" />
                글쓰기
              </Link>
            </Button>
          )
        }
      />

      <p className="mb-2 text-sm text-muted-foreground">
        전체 <span className="font-semibold text-foreground tabular-nums">{data?.total ?? 0}</span>건
        {data && data.total > 0 && (
          <span className="tabular-nums">
            {' '}
            · {page}/{totalPages} 페이지
          </span>
        )}
      </p>

      <Card className="gap-0 py-0">
        {loading ? (
          <ul className="divide-y">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <AnnouncementRowSkeleton key={i} />
            ))}
          </ul>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm">
            <p className="text-destructive">공지사항을 불러오지 못했어요.</p>
            <button type="button" onClick={reload} className="text-muted-foreground underline underline-offset-4">
              다시 시도
            </button>
          </div>
        ) : data && data.items.length > 0 ? (
          <ul className="divide-y">
            {data.items.map((item) => (
              <AnnouncementRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">등록된 공지사항이 없어요.</p>
        )}
      </Card>

      <div className="mt-5">
        <Pagination page={page} totalPages={totalPages} href={(n) => `/announcements?page=${n}`} />
      </div>
    </div>
  )
}
