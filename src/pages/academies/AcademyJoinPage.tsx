import { CheckCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Field } from '@/components/Field'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  errorMessage,
  findAcademyByCode,
  JOINABLE_ROLES,
  requestAcademyJoin,
  ROLE_LABEL,
  type AcademyRole,
} from '@/lib/academies'
import type { Profile } from '@/lib/profile'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

/** 학원 코드로 가입 신청: 코드 확인 → 역할 선택 → 신청 (원장 승인 대기) */
export function AcademyJoinPage({ profile }: { profile: Profile }) {
  const [code, setCode] = useState('')
  const [academy, setAcademy] = useState<{ id: number; name: string } | null>(null)
  const defaultRole = JOINABLE_ROLES.includes(profile.member_type) ? profile.member_type : 'teacher'
  const [role, setRole] = useState<AcademyRole>(defaultRole)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

  const handleFind = async (e: FormEvent) => {
    e.preventDefault()
    if (normalized.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      const found = await findAcademyByCode(normalized)
      if (found) setAcademy(found)
      else setError('학원 코드를 확인해 주세요. 승인되지 않은 학원의 코드는 쓸 수 없어요.')
    } catch (err) {
      setError(errorMessage(err, '학원을 찾지 못했어요. 잠시 후 다시 시도해 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    setBusy(true)
    setError(null)
    try {
      await requestAcademyJoin(normalized, role)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err, '신청하지 못했어요. 잠시 후 다시 시도해 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  if (done && academy) {
    return (
      <div>
        <PageHeader title="학원 가입" backTo="/" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <p className="font-semibold">{academy.name}에 가입을 신청했어요</p>
            <p className="text-sm text-muted-foreground">원장님이 승인하면 이용할 수 있어요.</p>
            <Button asChild className="mt-2">
              <Link to="/" replace>
                홈으로
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="학원 가입" backTo="/" />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleFind} className="flex flex-col gap-3">
            <Field label="학원 코드" hint="학원에서 받은 6자리 코드를 입력해 주세요.">
              <div className="flex gap-2">
                <input
                  value={normalized}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setAcademy(null)
                    setError(null)
                  }}
                  placeholder="ABC234"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className={cn(inputClass, 'font-mono tracking-[0.3em] uppercase')}
                  autoFocus
                />
                <Button type="submit" variant="outline" className="h-11" disabled={busy || normalized.length !== 6}>
                  확인
                </Button>
              </div>
            </Field>
          </form>

          {academy && (
            <div className="flex flex-col gap-3 border-t pt-4">
              <p>
                <span className="font-semibold">{academy.name}</span>
                <span className="text-muted-foreground">에 어떤 역할로 가입할까요?</span>
              </p>
              <div role="radiogroup" aria-label="역할" className="grid grid-cols-3 gap-2">
                {JOINABLE_ROLES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={role === value}
                    onClick={() => setRole(value)}
                    className={cn(
                      'h-11 rounded-lg border text-sm font-medium transition-colors',
                      role === value
                        ? 'border-primary bg-accent text-accent-foreground ring-1 ring-primary'
                        : 'hover:bg-muted',
                    )}
                  >
                    {ROLE_LABEL[value]}
                  </button>
                ))}
              </div>
              <Button size="lg" className="h-11" onClick={handleJoin} disabled={busy}>
                {busy ? '신청 중…' : '가입 신청'}
              </Button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
