import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { deleteMyAccount, fetchDeletionBlockers } from '@/lib/account'
import { errorMessage } from '@/lib/academies'

/** 회원 탈퇴: 지워지는 것·남는 것 안내 → 확인 체크 → 탈퇴 */
export function WithdrawPage({ onDone }: { onDone: () => void }) {
  const blockers = useAsync(fetchDeletionBlockers, [])
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocked = (blockers.data?.length ?? 0) > 0

  const withdraw = async () => {
    if (!window.confirm('정말 탈퇴할까요? 지운 정보는 되돌릴 수 없어요.')) return
    setBusy(true)
    setError(null)
    try {
      await deleteMyAccount()
      onDone()
    } catch (err) {
      setError(errorMessage(err, '탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setBusy(false)
      blockers.reload()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="회원 탈퇴" backTo="/settings" />

      <Card>
        <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
          <section>
            <h2 className="mb-1.5 font-semibold">바로 지워지는 정보</h2>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>회원 정보 (이름, 휴대폰 번호, 이메일, 회원 유형, 약관 동의 기록)</li>
              <li>로그인 계정과 카카오·네이버 연결</li>
              <li>학원 소속과 가입 신청 내역</li>
              <li>받은 알림</li>
            </ul>
          </section>
          <section>
            <h2 className="mb-1.5 font-semibold">남는 정보</h2>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>학원이 관리하는 학생 명단과 출석 기록 (학원에 삭제를 요청할 수 있어요)</li>
              <li>내가 쓴 공지나 체크한 출석은 남고, 작성자 정보만 지워져요</li>
            </ul>
          </section>
          <p className="text-muted-foreground">
            소속 학원 원장님께 탈퇴 사실이 알림으로 전달돼요. 같은 카카오·네이버 계정으로 다시 가입할 수 있지만, 이전
            정보는 복구되지 않아요.
          </p>
        </CardContent>
      </Card>

      {blockers.loading ? (
        <p className="text-center text-sm text-muted-foreground">탈퇴 가능 여부를 확인하는 중…</p>
      ) : blockers.error ? (
        <p className="text-center text-sm text-destructive">탈퇴 가능 여부를 확인하지 못했어요.</p>
      ) : blocked ? (
        <div className="flex gap-3 rounded-xl bg-warning/25 px-4 py-3 text-sm text-warning-foreground dark:text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">지금은 탈퇴할 수 없어요</p>
            {blockers.data!.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </div>
        </div>
      ) : (
        <>
          <label className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-destructive"
            />
            위 내용을 확인했고, 탈퇴하면 정보를 되돌릴 수 없다는 것에 동의해요.
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button variant="destructive" size="lg" className="h-11" disabled={!agreed || busy} onClick={withdraw}>
            {busy ? '탈퇴 처리 중…' : '탈퇴하기'}
          </Button>
        </>
      )}
    </div>
  )
}
