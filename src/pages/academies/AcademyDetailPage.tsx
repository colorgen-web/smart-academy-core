import { BookOpen, Check, ChevronRight, Copy, MapPin, Phone, RefreshCw, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { StatusBadge } from '@/components/academies/StatusBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import {
  decideAcademyMember,
  errorMessage,
  fetchAcademy,
  fetchAcademyMembers,
  fetchMyMembership,
  formatAcademyPhone,
  regenerateJoinCode,
  ROLE_LABEL,
  type Academy,
  type AcademyMember,
  type AcademyRole,
} from '@/lib/academies'
import { formatPhone } from '@/lib/profile'

export function AcademyDetailPage({ userId }: { userId: string }) {
  const id = Number(useParams().id)
  const valid = Number.isInteger(id)
  const { data, error, loading } = useAsync(
    async () => {
      if (!valid) return null
      const [academy, membership] = await Promise.all([fetchAcademy(id), fetchMyMembership(id, userId)])
      return academy ? { academy, membership } : null
    },
    [id, userId],
  )

  if (loading) {
    return (
      <div>
        <PageHeader title="학원" backTo="/" />
        <Card>
          <CardContent className="flex flex-col gap-3" aria-hidden="true">
            <span className="h-6 w-1/2 animate-pulse rounded bg-muted" />
            <span className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="학원" backTo="/" />
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-semibold">{error ? '학원 정보를 불러오지 못했어요.' : '볼 수 없는 학원이에요.'}</p>
          <Button variant="outline" asChild>
            <Link to="/">홈으로</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { academy, membership } = data
  const isDirector = membership?.role === 'director' && membership.status === 'approved'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="학원" backTo="/" />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <h2 className="flex-1 text-lg font-semibold leading-snug">{academy.name}</h2>
            <StatusBadge status={academy.status} />
          </div>
          {(academy.phone || academy.address) && (
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {academy.phone && (
                <span className="flex items-center gap-2">
                  <Phone className="size-4" />
                  {formatAcademyPhone(academy.phone)}
                </span>
              )}
              {academy.address && (
                <span className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  {academy.address}
                </span>
              )}
            </div>
          )}
          {membership && (
            <p className="flex items-center gap-2 border-t pt-3 text-sm">
              <span className="text-muted-foreground">내 소속</span>
              <Badge variant="outline">{ROLE_LABEL[membership.role]}</Badge>
              {membership.status !== 'approved' && <StatusBadge status={membership.status} />}
            </p>
          )}
        </CardContent>
      </Card>

      {academy.status === 'pending' && (
        <Notice>운영자 승인을 기다리고 있어요. 승인되면 학원 코드로 회원을 받을 수 있어요.</Notice>
      )}
      {academy.status === 'rejected' && (
        <Notice tone="destructive">
          등록이 승인되지 않았어요.{academy.review_note && ` 사유: ${academy.review_note}`}
        </Notice>
      )}
      {academy.status === 'approved' && membership?.status === 'pending' && (
        <Notice>원장님이 가입 신청을 확인하고 있어요.</Notice>
      )}
      {academy.status === 'approved' && membership?.status === 'rejected' && (
        <Notice tone="destructive">가입 신청이 승인되지 않았어요. 학원에 문의해 주세요.</Notice>
      )}

      {academy.status === 'approved' &&
        membership?.status === 'approved' &&
        (membership.role === 'director' || membership.role === 'teacher') && (
          <Card className="gap-0 py-0">
            <Link to="/classes" className="flex items-center gap-3 border-b px-4 py-3 hover:bg-muted/60">
              <BookOpen className="size-4 text-primary" />
              <span className="flex-1 font-medium">반·시간표</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <Link to={`/academies/${academy.id}/students`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
              <UsersRound className="size-4 text-primary" />
              <span className="flex-1 font-medium">학생 명단</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </Card>
        )}

      {isDirector && <DirectorPanel academy={academy} />}
    </div>
  )
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: 'destructive' }) {
  return (
    <p
      className={
        tone === 'destructive'
          ? 'rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive'
          : 'rounded-xl bg-warning/25 px-4 py-3 text-sm text-warning-foreground dark:text-warning'
      }
    >
      {children}
    </p>
  )
}

/** 원장 전용: 학원 코드, 가입 신청 승인, 소속 회원 */
function DirectorPanel({ academy }: { academy: Academy }) {
  const [code, setCode] = useState(academy.join_code)
  const [copied, setCopied] = useState(false)
  const members = useAsync(() => fetchAcademyMembers(academy.id), [academy.id])
  const [busyUser, setBusyUser] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('학원 코드를 복사해 주세요', code)
    }
  }

  const regenerate = async () => {
    if (!window.confirm('새 코드를 만들까요? 기존 코드로는 더 이상 가입 신청을 할 수 없어요.')) return
    try {
      setCode(await regenerateJoinCode(academy.id))
    } catch (err) {
      window.alert(errorMessage(err, '코드를 바꾸지 못했어요.'))
    }
  }

  const decide = async (member: AcademyMember, approve: boolean) => {
    if (!approve && !window.confirm(`${member.name}님의 신청을 거절할까요?`)) return
    setBusyUser(member.user_id)
    setActionError(null)
    try {
      await decideAcademyMember(academy.id, member.user_id, approve)
      members.reload()
    } catch (err) {
      setActionError(errorMessage(err, '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'))
    } finally {
      setBusyUser(null)
    }
  }

  if (academy.status !== 'approved') return null

  const pending = members.data?.filter((m) => m.status === 'pending') ?? []
  const approved = members.data?.filter((m) => m.status === 'approved') ?? []
  const byRole = (['director', 'teacher', 'parent', 'student'] as AcademyRole[])
    .map((role) => ({ role, list: approved.filter((m) => m.role === role) }))
    .filter((g) => g.list.length > 0)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>학원 코드</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex-1 rounded-lg bg-muted px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.35em]">
              {code}
            </span>
            <Button variant="outline" size="icon-lg" onClick={copy} aria-label="코드 복사">
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            강사·학부모·학생에게 이 코드를 알려 주세요. 가입 신청은 아래에서 승인해요.
          </p>
          <button
            type="button"
            onClick={regenerate}
            className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3" />새 코드 만들기
          </button>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h3 className="flex-1 font-semibold">가입 신청</h3>
          {pending.length > 0 && <Badge>{pending.length}</Badge>}
        </div>
        {members.loading ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">불러오는 중…</p>
        ) : members.error ? (
          <p className="px-4 py-5 text-sm text-destructive">신청 목록을 불러오지 못했어요.</p>
        ) : pending.length === 0 ? (
          <p className="px-4 py-5 text-center text-sm text-muted-foreground">새 가입 신청이 없어요.</p>
        ) : (
          <ul className="divide-y">
            {pending.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{m.name}</span>
                    <Badge variant="outline">{ROLE_LABEL[m.role]}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatPhone(m.phone)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide(m, false)}
                  disabled={busyUser === m.user_id}
                  aria-label={`${m.name} 거절`}
                >
                  <X />
                </Button>
                <Button size="sm" onClick={() => decide(m, true)} disabled={busyUser === m.user_id}>
                  승인
                </Button>
              </li>
            ))}
          </ul>
        )}
        {actionError && <p className="border-t px-4 py-2 text-sm text-destructive">{actionError}</p>}
      </Card>

      {byRole.length > 0 && (
        <Card className="gap-0 py-0">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">소속 회원 {approved.length}명</h3>
          </div>
          {byRole.map(({ role, list }) => (
            <div key={role} className="border-b px-4 py-3 last:border-b-0">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {ROLE_LABEL[role]} {list.length}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {list.map((m) => (
                  <li key={m.user_id} className="flex justify-between gap-2">
                    <span className="truncate">{m.name}</span>
                    <span className="text-muted-foreground tabular-nums">{formatPhone(m.phone)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}
