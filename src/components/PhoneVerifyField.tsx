import { CheckCircle2, MessageSquareText } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { isValidPhone } from '@/lib/profile'
import { sendPhoneCode, verifyPhoneCode } from '@/lib/phoneVerification'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

type Sent = { phone: string; expiresAt: number; resendAt: number }

type PhoneVerifyFieldProps = {
  /** 인증할 번호 (숫자만) */
  phone: string
  /** 이 번호가 이미 인증됐는가 */
  verified: boolean
  onVerified: (phone: string) => void
}

/**
 * 휴대폰 문자 인증: 인증번호 받기 → 6자리 입력 → 확인.
 * 번호를 바꾸면 처음부터 다시 한다 (받은 인증번호는 그 번호에만 쓸 수 있다).
 */
export function PhoneVerifyField({ phone, verified, onVerified }: PhoneVerifyFieldProps) {
  const [sent, setSent] = useState<Sent | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null)
  const [error, setError] = useState<{ phone: string; text: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const active = sent?.phone === phone ? sent : null
  const ticking = active !== null && !verified

  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])

  if (verified) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" />
        휴대폰 인증 완료
      </p>
    )
  }

  const valid = isValidPhone(phone)
  const remaining = active ? Math.max(0, Math.ceil((active.expiresAt - now) / 1000)) : 0
  const resendIn = active ? Math.max(0, Math.ceil((active.resendAt - now) / 1000)) : 0
  const expired = active !== null && remaining === 0
  const errorText = error?.phone === phone ? error.text : null

  const handleSend = async () => {
    setBusy('send')
    setError(null)
    const result = await sendPhoneCode(phone)
    const at = Date.now()
    setNow(at)
    if (result.ok) {
      setSent({
        phone,
        expiresAt: at + (result.expiresIn ?? 180) * 1000,
        resendAt: at + (result.resendAfter ?? 60) * 1000,
      })
      setCode('')
    } else {
      setError({ phone, text: result.error })
      if (result.retryAfter && active) setSent({ ...active, resendAt: at + result.retryAfter * 1000 })
    }
    setBusy(null)
  }

  const handleVerify = async () => {
    if (!active) return
    setBusy('verify')
    setError(null)
    const result = await verifyPhoneCode(phone, code)
    if (result.ok) {
      onVerified(phone)
    } else {
      setError({ phone, text: result.error })
      if (result.expired) setSent({ ...active, expiresAt: Date.now() })
    }
    setBusy(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={handleSend}
        disabled={!valid || busy !== null || resendIn > 0}
      >
        <MessageSquareText data-icon="inline-start" />
        {busy === 'send'
          ? '보내는 중…'
          : active
            ? resendIn > 0
              ? `인증번호 다시 받기 (${resendIn}초)`
              : '인증번호 다시 받기'
            : '인증번호 받기'}
      </Button>

      {active && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                // 회원가입 폼이 제출되지 않게, 엔터는 인증번호 확인으로
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (code.length === 6 && !expired && !busy) handleVerify()
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="인증번호 6자리"
              aria-label="인증번호"
              disabled={expired}
              className={cn(inputClass, 'pr-14 tabular-nums tracking-widest disabled:opacity-60')}
            />
            <span
              className={cn(
                'absolute top-1/2 right-3 -translate-y-1/2 text-sm tabular-nums',
                expired || remaining <= 30 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </span>
          </div>
          <Button
            type="button"
            className="h-11 px-4"
            onClick={handleVerify}
            disabled={code.length !== 6 || expired || busy !== null}
          >
            {busy === 'verify' ? '확인 중…' : '확인'}
          </Button>
        </div>
      )}

      {errorText ? (
        <p role="alert" className="text-xs text-destructive">
          {errorText}
        </p>
      ) : active ? (
        <p className="text-xs text-muted-foreground">
          {expired ? '인증 시간이 지났어요. 인증번호를 다시 받아 주세요.' : '문자로 받은 인증번호를 3분 안에 입력해 주세요.'}
        </p>
      ) : null}
    </div>
  )
}
