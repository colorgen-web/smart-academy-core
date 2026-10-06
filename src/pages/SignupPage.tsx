import type { User } from '@supabase/supabase-js'
import { ChevronDown, GraduationCap, Presentation, School, UsersRound, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import { Field } from '@/components/Field'
import { KakaoIcon, NaverIcon } from '@/components/icons/social'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'
import {
  accountProvider,
  createProfile,
  formatPhone,
  isValidPhone,
  MEMBER_TYPE_LABEL,
  normalizePhone,
  PhoneTakenError,
  PROVIDER_LABEL,
  socialInfo,
  type MemberType,
  type Profile,
} from '@/lib/profile'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

const MEMBER_TYPES: { value: MemberType; icon: LucideIcon; hint: string }[] = [
  { value: 'parent', icon: UsersRound, hint: '자녀 출결·수업 확인' },
  { value: 'student', icon: GraduationCap, hint: '만 14세 이상' },
  { value: 'teacher', icon: Presentation, hint: '학원 승인 후 이용' },
  { value: 'director', icon: School, hint: '학원 승인 후 이용' },
]

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

  const digits = normalizePhone(phone)
  const allAgreed = agreed.terms && agreed.privacy && agreed.age
  const canSubmit = name.trim().length > 0 && isValidPhone(digits) && memberType !== null && allAgreed && !saving

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
          <Field label="휴대폰 번호" hint="학원 연락과 중복 가입 확인에 사용해요.">
            <input
              value={formatPhone(phone)}
              onChange={(e) => setPhone(normalizePhone(e.target.value))}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="010-1234-5678"
              aria-invalid={digits.length >= 10 && !isValidPhone(digits) ? true : undefined}
              className={inputClass}
            />
          </Field>
        </Section>

        <Section title="회원 유형">
          <div role="radiogroup" aria-label="회원 유형" className="grid grid-cols-2 gap-2">
            {MEMBER_TYPES.map(({ value, icon: Icon, hint }) => {
              const selected = memberType === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMemberType(value)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                    selected
                      ? 'border-primary bg-accent text-accent-foreground ring-1 ring-primary'
                      : 'bg-card hover:bg-muted',
                  )}
                >
                  <Icon className={cn('size-5', selected ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="font-semibold">{MEMBER_TYPE_LABEL[value]}</span>
                  <span className={cn('text-xs', selected ? 'opacity-80' : 'text-muted-foreground')}>{hint}</span>
                </button>
              )
            })}
          </div>
          {memberType === 'student' && (
            <p className="text-xs text-muted-foreground">만 14세 미만 학생은 보호자가 학부모로 가입한 뒤 등록해 주세요.</p>
          )}
          {(memberType === 'teacher' || memberType === 'director') && (
            <p className="text-xs text-muted-foreground">
              {MEMBER_TYPE_LABEL[memberType]} 기능은 학원 승인 후 사용할 수 있어요.
            </p>
          )}
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
              이용약관 전문은 정식 서비스 오픈 전에 게시할 예정이에요.
            </AgreementItem>
            <AgreementItem
              label="개인정보 수집·이용"
              checked={agreed.privacy}
              onChange={(v) => setAgreed((a) => ({ ...a, privacy: v }))}
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                <dt className="font-medium text-foreground">수집 항목</dt>
                <dd>이름, 휴대폰 번호, 이메일, 회원 유형, 소셜 로그인 식별자</dd>
                <dt className="font-medium text-foreground">이용 목적</dt>
                <dd>회원 식별, 학원 서비스 제공, 공지·출결 등 연락</dd>
                <dt className="font-medium text-foreground">보유 기간</dt>
                <dd>회원 탈퇴 시까지 (법령에 따라 보관이 필요한 경우 그 기간)</dd>
              </dl>
              <p className="mt-2">동의를 거부할 수 있으나, 거부하면 회원가입을 할 수 없어요.</p>
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
