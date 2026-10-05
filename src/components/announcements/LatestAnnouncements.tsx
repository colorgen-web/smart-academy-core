import { ChevronRight, Megaphone } from 'lucide-react'
import { Link } from 'react-router'

import { AnnouncementRow, AnnouncementRowSkeleton } from '@/components/announcements/AnnouncementRow'
import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { fetchLatestAnnouncements, HOME_LIMIT } from '@/lib/announcements'

/** 메인 화면 공지사항: 최신 5개 + 전체보기 */
export function LatestAnnouncements() {
  const { data, error, loading, reload } = useAsync(fetchLatestAnnouncements, [])

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Megaphone className="size-4 text-primary" />
        <h2 className="flex-1 font-semibold">공지사항</h2>
        <Link
          to="/announcements"
          className="flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          전체보기
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {loading ? (
        <ul className="divide-y">
          {Array.from({ length: 3 }, (_, i) => (
            <AnnouncementRowSkeleton key={i} />
          ))}
        </ul>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm">
          <p className="text-destructive">공지사항을 불러오지 못했어요.</p>
          <button type="button" onClick={reload} className="text-muted-foreground underline underline-offset-4">
            다시 시도
          </button>
        </div>
      ) : data && data.length > 0 ? (
        <ul className="divide-y">
          {data.slice(0, HOME_LIMIT).map((item) => (
            <AnnouncementRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">등록된 공지사항이 없어요.</p>
      )}
    </Card>
  )
}
