import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import {
  errorMessage,
  fetchAcademiesForReview,
  formatAcademyPhone,
  reviewAcademy,
  STATUS_LABEL,
  type AcademyForReview,
  type ApprovalStatus,
} from '@/lib/academies'
import { formatDate } from '@/lib/announcements'
import { formatPhone } from '@/lib/profile'
import { cn } from '@/lib/utils'

const TABS: ApprovalStatus[] = ['pending', 'approved', 'rejected']

/** 운영자: 학원 등록 승인 */
export function AdminAcademiesPage() {
  const [params] = useSearchParams()
  const raw = params.get('status')
  const status: ApprovalStatus = TABS.includes(raw as ApprovalStatus) ? (raw as ApprovalStatus) : 'pending'
  const { data, error, loading, reload } = useAsync(() => fetchAcademiesForReview(status), [status])
  const [busyId, setBusyId] = useState<number | null>(null)

  const review = async (academy: AcademyForReview, approve: boolean) => {
    let note: string | undefined
    if (!approve) {
      const input = window.prompt(`${academy.name} 등록을 거절할까요? 사유를 적어 주세요 (원장에게 보여요).`)
      if (input === null) return
      note = input
    }
    setBusyId(academy.id)
    try {
      await reviewAcademy(academy.id, approve, note)
      reload()
    } catch (err) {
      window.alert(errorMessage(err, '처리하지 못했어요.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="학원 승인 관리" backTo="/settings" />

      <nav className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" aria-label="상태">
        {TABS.map((tab) => (
          <Link
            key={tab}
            to={`/admin/academies?status=${tab}`}
            replace
            aria-current={tab === status ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-colors',
              tab === status
                ? 'bg-card text-foreground shadow-sm dark:bg-accent dark:text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {STATUS_LABEL[tab]}
          </Link>
        ))}
      </nav>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-destructive">목록을 불러오지 못했어요.</p>
      ) : !data || data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{STATUS_LABEL[status]} 학원이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((academy) => (
            <li key={academy.id}>
              <Card size="sm">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <Link to={`/academies/${academy.id}`} className="flex-1 font-semibold hover:underline">
                      {academy.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{formatDate(academy.created_at)}</span>
                  </div>
                  <dl className="grid grid-cols-[4rem_1fr] gap-y-1 text-sm">
                    <dt className="text-muted-foreground">원장</dt>
                    <dd>
                      {academy.owner ? `${academy.owner.name} · ${formatPhone(academy.owner.phone)}` : '—'}
                    </dd>
                    <dt className="text-muted-foreground">전화</dt>
                    <dd>{formatAcademyPhone(academy.phone) ?? '—'}</dd>
                    <dt className="text-muted-foreground">주소</dt>
                    <dd>{academy.address ?? '—'}</dd>
                    {academy.review_note && (
                      <>
                        <dt className="text-muted-foreground">메모</dt>
                        <dd>{academy.review_note}</dd>
                      </>
                    )}
                  </dl>
                  {status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => review(academy, false)}
                        disabled={busyId === academy.id}
                      >
                        거절
                      </Button>
                      <Button className="flex-1" onClick={() => review(academy, true)} disabled={busyId === academy.id}>
                        승인
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
