import { Pin, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { deleteAnnouncement, fetchAnnouncement, formatDate } from '@/lib/announcements'

export function AnnouncementDetailPage({ isAdmin }: { isAdmin: boolean }) {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data, error, loading } = useAsync(() => (Number.isInteger(id) ? fetchAnnouncement(id) : Promise.resolve(null)), [id])
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm('이 공지사항을 삭제할까요?')) return
    setDeleting(true)
    try {
      await deleteAnnouncement(id)
      navigate('/announcements', { replace: true })
    } catch {
      window.alert('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="공지사항"
        backTo="/announcements"
        action={
          isAdmin &&
          data && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              <Trash2 data-icon="inline-start" />
              삭제
            </Button>
          )
        }
      />

      {loading ? (
        <Card>
          <CardContent className="flex flex-col gap-3" aria-hidden="true">
            <span className="h-6 w-3/4 animate-pulse rounded bg-muted" />
            <span className="h-4 w-24 animate-pulse rounded bg-muted" />
            <span className="mt-2 h-24 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : error || !data ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-semibold">{error ? '공지사항을 불러오지 못했어요.' : '없는 공지사항이에요.'}</p>
          <Button variant="outline" asChild>
            <Link to="/announcements">목록으로</Link>
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent>
            <article className="flex flex-col gap-4">
              <header className="flex flex-col gap-2 border-b pb-4">
                {data.is_pinned && (
                  <Badge className="w-fit gap-1">
                    <Pin data-icon="inline-start" />
                    고정 공지
                  </Badge>
                )}
                <h2 className="text-lg font-semibold leading-snug">{data.title}</h2>
                <p className="text-sm text-muted-foreground">
                  관리자 · <time dateTime={data.created_at}>{formatDate(data.created_at)}</time>
                </p>
              </header>
              <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{data.content}</div>
            </article>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
