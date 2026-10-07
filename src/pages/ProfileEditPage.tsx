import { Info } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Field } from '@/components/Field'
import { PageHeader } from '@/components/layout/PageHeader'
import { MemberTypePicker } from '@/components/MemberTypePicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { errorMessage } from '@/lib/academies'
import {
  formatPhone,
  isValidPhone,
  normalizePhone,
  PhoneTakenError,
  PROVIDER_LABEL,
  updateProfile,
  type MemberType,
  type Profile,
} from '@/lib/profile'
import { inputClass } from '@/lib/styles'

/** 설정 → 회원 정보 수정: 이름·휴대폰·회원 유형 (이메일·가입 방법은 소셜 계정 정보라 바꿀 수 없음) */
export function ProfileEditPage({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [memberType, setMemberType] = useState<MemberType>(profile.member_type)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const digits = normalizePhone(phone)
  const phoneChanged = digits !== profile.phone
  const changed = name.trim() !== profile.name || phoneChanged || memberType !== profile.member_type
  const canSave = changed && name.trim().length > 0 && isValidPhone(digits) && !saving

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const saved = await updateProfile(
        profile.id,
        { name: name.trim(), phone: digits, member_type: memberType },
        profile.phone,
      )
      onSaved(saved)
      navigate('/settings', { replace: true })
    } catch (err) {
      if (err instanceof PhoneTakenError) {
        setError(
          err.provider
            ? `이 번호는 다른 ${PROVIDER_LABEL[err.provider]} 계정에서 쓰고 있어요.`
            : '이미 다른 계정에서 쓰고 있는 번호예요.',
        )
      } else {
        setError(errorMessage(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      }
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="회원 정보 수정" backTo="/settings" />

      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">가입 방법</dt>
            <dd>{PROVIDER_LABEL[profile.provider]}</dd>
            <dt className="text-muted-foreground">이메일</dt>
            <dd className="truncate">{profile.email ?? '—'}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            이메일은 {PROVIDER_LABEL[profile.provider]} 계정에서 받아오는 정보라 여기서 바꿀 수 없어요.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Field label="이름">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                autoComplete="name"
                className={inputClass}
              />
            </Field>
            <Field label="휴대폰 번호">
              <input
                value={formatPhone(phone)}
                onChange={(e) => {
                  setPhone(normalizePhone(e.target.value))
                  setError(null)
                }}
                inputMode="numeric"
                autoComplete="tel-national"
                aria-invalid={digits.length >= 10 && !isValidPhone(digits) ? true : undefined}
                className={inputClass}
              />
            </Field>
            {phoneChanged && isValidPhone(digits) && (
              <p className="flex gap-2 rounded-lg bg-warning/25 px-3 py-2.5 text-xs leading-relaxed text-warning-foreground dark:text-warning">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                학부모·학생 회원은 학원에 등록된 연락처로 자녀(본인) 정보가 연결돼요. 번호를 바꾸면 학원에 새 번호를 알려
                주셔야 계속 볼 수 있어요.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="font-semibold">회원 유형</h2>
            <MemberTypePicker value={memberType} onChange={setMemberType} />
            {memberType !== profile.member_type && (
              <p className="text-xs text-muted-foreground">
                이미 승인된 학원 소속의 역할은 바뀌지 않아요. 학원에서의 역할을 바꾸려면 학원에 문의해 주세요.
              </p>
            )}
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11" disabled={!canSave}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </form>
    </div>
  )
}
