import type { User } from '@supabase/supabase-js'
import { ChevronDown } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import { Field } from '@/components/Field'
import { KakaoIcon, NaverIcon } from '@/components/icons/social'
import { MemberTypePicker } from '@/components/MemberTypePicker'
import { PhoneVerifyField } from '@/components/PhoneVerifyField'
import { Button } from '@/components/ui/button'
import { usePhoneVerificationRequired } from '@/hooks/usePhoneVerificationRequired'
import { signOut } from '@/lib/auth'
import {
  accountProvider,
  createProfile,
  formatPhone,
  isValidPhone,
  normalizePhone,
  PhoneTakenError,
  PROVIDER_LABEL,
  socialInfo,
  type MemberType,
  type Profile,
} from '@/lib/profile'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

type Agreement = 'terms' | 'privacy' | 'age'

type SignupPageProps = {
  user: User
  onComplete: (profile: Profile) => void
}

/** 로그인 후 회원 정보가 없을 때 보여주는 회원가입 화면 */
export function SignupPage({ user, onComplete }: SignupPageProps) {
  const provider = accountProvider(user)
  const [name, setName] = useState(() => socialInfo(user).name.slice(0, 30))
  const [phone, setPhone] = useState('')
  const [memberType, setMemberType] = useState<MemberType | null>(null)
  const [agreed, setAgreed] = useState<Record<Agreement, boolean>>({ terms: false, privacy: false, age: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const verificationRequired = usePhoneVerificationRequired()
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null)

  const digits = normalizePhone(phone)
  const phoneOk = verificationRequired === false || (verificationRequired === true && verifiedPhone === digits)
  const allAgreed = agreed.terms && agreed.privacy && agreed.age
  const canSubmit =
    name.trim().length > 0 && isValidPhone(digits) && phoneOk && memberType !== null && allAgreed && !saving

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !memberType) return
    setSaving(true)
    setError(null)
    try {
      const profile = await createProfile({
        name: name.trim(),
        phone: digits,
        member_type: memberType,
        over_14_confirmed: true,
      })
      onComplete(profile)
    } catch (err) {
      if (err instanceof PhoneTakenError) {
        setError(
          !err.provider
            ? '이미 가입된 휴대폰 번호예요.'
            : err.provider !== provider
              ? `이 번호는 ${PROVIDER_LABEL[err.provider]}로 가입돼 있어요. ${PROVIDER_LABEL[err.provider]}로 로그인해 주세요.`
              : `이 번호는 다른 ${PROVIDER_LABEL[err.provider]} 계정으로 가입돼 있어요. 그 계정으로 로그인해 주세요.`,
        )
      } else if ((err as { code?: string }).code === 'P0001') {
        // 인증 후 30분이 지났거나 인증하지 않은 번호
        setVerifiedPhone(null)
        setError('휴대폰 인증이 만료됐어요. 다시 인증해 주세요.')
      } else {
        setError('가입하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
      setSaving(false)
    }
  }

  const ProviderIcon = provider === 'naver' ? NaverIcon : KakaoIcon

  return (
    <main className="min-h-svh bg-muted/40 px-4 py-8">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2">
          <img src="/favicon.svg" alt="" className="size-11" />
          <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
          <p className="text-sm text-muted-foreground">처음 오셨네요! 몇 가지만 입력하면 시작할 수 있어요.</p>
          <span
            className={cn(
              'flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              provider === 'naver' ? 'bg-[#03C75A] text-white' : 'bg-[#FEE500] text-black/85',
            )}
          >
            <ProviderIcon className="size-3" />
            {PROVIDER_LABEL[provider]} 계정으로 가입
          </span>
        </header>

        <Section title="기본 정보">
          <Field label="이름">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              autoComplete="name"
              placeholder="홍길동"
              className={inputClass}
            />
          </Field>
          <Field
            label="휴대폰 번호"
            hint={verificationRequired ? '본인 확인과 학원 연락에 사용해요.' : '학원 연락과 중복 가입 확인에 사용해요.'}
          >
            <input
              value={formatPhone(phone)}
              onChange={(e) => {
                setPhone(normalizePhone(e.target.value))
                setError(null)
              }}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="010-1234-5678"
              aria-invalid={digits.length >= 10 && !isValidPhone(digits) ? true : undefined}
              className={inputClass}
            />
          </Field>
          {verificationRequired && (
            <PhoneVerifyField phone={digits} verified={verifiedPhone === digits} onVerified={setVerifiedPhone} />
          )}
        </Section>

        <Section title="회원 유형">
          <MemberTypePicker value={memberType} onChange={setMemberType} />
        </Section>

        <Section title="약관 동의">
          <label className="flex items-center gap-3 rounded-xl bg-muted px-3 py-3 font-semibold">
            <input
              type="checkbox"
              checked={allAgreed}
              onChange={(e) => setAgreed({ terms: e.target.checked, privacy: e.target.checked, age: e.target.checked })}
              className={checkboxClass}
            />
            전체 동의
          </label>
          <div className="flex flex-col">
            <AgreementItem
              label="서비스 이용약관"
              checked={agreed.terms}
              onChange={(v) => setAgreed((a) => ({ ...a, terms: v }))}
            >
              학원 관리 서비스의 이용 조건, 회원·원장의 의무, 탈퇴와 이용 제한 등을 정해요.
              <FullText to="/terms" />
            </AgreementItem>
            <AgreementItem
              label="개인정보 수집·이용"
              checked={agreed.privacy}
              onChange={(v) => setAgreed((a) => ({ ...a, privacy: v }))}
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                <dt className="font-medium text-foreground">수집 항목</dt>
                <dd>이름, 휴대폰 번호, 회원 유형, 소셜 로그인 식별자·이메일·프로필 사진</dd>
                <dt className="font-medium text-foreground">이용 목적</dt>
                <dd>회원 식별, 학원 연결과 학원 관리 기능 제공, 출석·공지 등 알림</dd>
                <dt className="font-medium text-foreground">보유 기간</dt>
                <dd>회원 탈퇴 시까지 (법령에 따라 보관이 필요한 경우 그 기간)</dd>
                <dt className="font-medium text-foreground">처리 위탁·국외 이전</dt>
                <dd>Supabase(데이터 저장, 서울 리전)·Vercel(호스팅), 미국 법인 / (주)누리고(인증 문자 발송)</dd>
              </dl>
              <p className="mt-2">동의를 거부할 수 있으나, 거부하면 회원가입을 할 수 없어요.</p>
              <FullText to="/privacy" />
            </AgreementItem>
            <AgreementItem label="만 14세 이상입니다" checked={agreed.age} onChange={(v) => setAgreed((a) => ({ ...a, age: v }))} />
          </div>
        </Section>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" className="h-12 text-[15px]" disabled={!canSubmit}>
            {saving ? '가입 중…' : '가입하고 시작하기'}
          </Button>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </form>
    </main>
  )
}

const checkboxClass = 'size-5 shrink-0 accent-primary'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** 약관 전문 보기 (회원가입 입력이 사라지지 않게 새 탭으로) */
function FullText({ to }: { to: string }) {
  return (
    <a href={to} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-primary underline underline-offset-4">
      전문 보기
    </a>
  )
}

function AgreementItem({
  label,
  checked,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b py-2.5 last:border-b-0">
      <div className="flex items-center gap-3 px-3">
        <label className="flex flex-1 items-center gap-3 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={checkboxClass} />
          <span>
            <span className="font-medium text-primary">[필수]</span> {label}
          </span>
        </label>
        {children && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            보기
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>
      {children && open && (
        <div className="mx-3 mt-2 rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  )
}
