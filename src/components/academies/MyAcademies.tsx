import { ChevronRight, Plus, School, Ticket } from 'lucide-react'
import { Link } from 'react-router'

import { StatusBadge } from '@/components/academies/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { fetchMyAcademies, ROLE_LABEL } from '@/lib/academies'
import type { Profile } from '@/lib/profile'

/** 메인 화면: 내가 소속된(신청 포함) 학원 목록 + 가입/등록 버튼 */
export function MyAcademies({ profile }: { profile: Profile }) {
  const { data, error, loading, reload } = useAsync(() => fetchMyAcademies(profile.id), [profile.id])
  const isDirector = profile.member_type === 'director'

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <School className="size-4 text-primary" />
        <h2 className="flex-1 font-semibold">내 학원</h2>
      </div>

      {loading ? (
        <div className="px-4 py-3" aria-hidden="true">
          <span className="block h-5 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 px-4 py-5 text-center text-sm">
          <p className="text-destructive">학원 목록을 불러오지 못했어요.</p>
          <button type="button" onClick={reload} className="text-muted-foreground underline underline-offset-4">
            다시 시도
          </button>
        </div>
      ) : data && data.length > 0 ? (
        <ul className="divide-y">
          {data.map(({ academy, role, status }) => (
            <li key={academy.id}>
              <Link
                to={`/academies/${academy.id}`}
                className="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{academy.name}</span>
                <Badge variant="outline">{ROLE_LABEL[role]}</Badge>
                {academy.status !== 'approved' ? (
                  <StatusBadge status={academy.status} />
                ) : (
                  status !== 'approved' && <StatusBadge status={status} />
                )}
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-center text-sm text-muted-foreground">
          {isDirector ? '학원을 등록하거나, 다른 학원에 가입해 보세요.' : '학원에서 받은 코드로 가입해 보세요.'}
        </p>
      )}

      <div className="flex gap-2 border-t px-4 py-3">
        <Button asChild variant="outline" className="flex-1">
          <Link to="/academies/join">
            <Ticket data-icon="inline-start" />
            코드로 가입
          </Link>
        </Button>
        {isDirector && (
          <Button asChild className="flex-1">
            <Link to="/academies/new">
              <Plus data-icon="inline-start" />
              학원 등록
            </Link>
          </Button>
        )}
      </div>
    </Card>
  )
}
