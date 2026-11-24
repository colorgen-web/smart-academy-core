import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { EmblemPicker } from '@/components/academies/AcademyEmblem'
import { Field } from '@/components/Field'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { errorMessage, registerAcademy, setAcademyEmblem } from '@/lib/academies'
import { inputClass } from '@/lib/styles'

/** 원장: 학원 등록 → 운영자 승인 대기 */
export function AcademyRegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [emblem, setEmblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phoneDigits = phone.replace(/\D/g, '')
  const phoneInvalid = phoneDigits.length > 0 && !/^0\d{8,10}$/.test(phoneDigits)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || phoneInvalid) return
    setSaving(true)
    setError(null)
    try {
      const id = await registerAcademy({ name: name.trim(), phone: phoneDigits, address: address.trim() })
      // 엠블렘 저장이 실패해도 등록은 된 것이므로 학원 화면으로 보낸다 (거기서 다시 올릴 수 있다)
      if (emblem) await setAcademyEmblem(id, emblem).catch(() => undefined)
      navigate(`/academies/${id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, '등록하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="학원 등록" backTo="/" />
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">학원 엠블렘 (선택)</span>
              <EmblemPicker value={emblem} name={name} onChange={setEmblem} disabled={saving} />
            </div>
            <Field label="학원 이름">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder="스마트수학학원"
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field label="학원 전화번호 (선택)">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="02-123-4567"
                aria-invalid={phoneInvalid || undefined}
                className={inputClass}
              />
            </Field>
            <Field label="주소 (선택)">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={200}
                placeholder="서울시 강남구 …"
                className={inputClass}
              />
            </Field>
            <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              운영자가 확인한 뒤 승인하면 학원 코드가 활성화되고, 강사·학부모·학생이 가입할 수 있어요.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-11" disabled={saving || !name.trim() || phoneInvalid}>
              {saving ? '등록 중…' : '등록 신청'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
