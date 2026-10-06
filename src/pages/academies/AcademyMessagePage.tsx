import { CheckCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'

import { Field } from '@/components/Field'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage, fetchAcademy, ROLE_LABEL } from '@/lib/academies'
import { sendAcademyMessage } from '@/lib/notifications'
import { inputClass } from '@/lib/styles'
import { cn } from '@/lib/utils'

const TARGETS = ['parent', 'student', 'teacher'] as const
type Target = (typeof TARGETS)[number]

/** 원장: 학원 소속 회원에게 알림 보내기 (권한·하루 횟수는 DB 함수가 확인) */
export function AcademyMessagePage() {
  const academyId = Number(useParams().id)
  const academy = useAsync(() => fetchAcademy(academyId), [academyId])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targets, setTargets] = useState<Set<Target>>(new Set(['parent', 'student']))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<number | null>(null)

  const toggle = (t: Target) =>
    setTargets((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || targets.size === 0) return
    const who = [...targets].map((t) => ROLE_LABEL[t]).join('·')
    if (!window.confirm(`${who}에게 알림을 보낼까요?`)) return
    setSending(true)
    setError(null)
    try {
      setSent(await sendAcademyMessage(academyId, title.trim(), body.trim(), [...targets]))
    } catch (err) {
      setError(errorMessage(err, '보내지 못했어요. 잠시 후 다시 시도해 주세요.'))
    } finally {
      setSending(false)
    }
  }

  if (sent !== null) {
    return (
      <div>
        <PageHeader title="알림 보내기" backTo="/notices" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <p className="font-semibold">{sent > 0 ? `${sent}명에게 알림을 보냈어요` : '받을 회원이 없어요'}</p>
            {sent === 0 && <p className="text-sm text-muted-foreground">고른 역할로 승인된 회원이 아직 없어요.</p>}
            <div className="mt-2 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSent(null)
                  setTitle('')
                  setBody('')
                }}
              >
                하나 더 보내기
              </Button>
              <Button asChild>
                <Link to="/notices">알림으로</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="알림 보내기" backTo="/notices" />
      {academy.data && <p className="-mt-2 mb-4 text-sm text-muted-foreground">{academy.data.name}</p>}
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">받는 사람</span>
              <div role="group" aria-label="받는 사람" className="grid grid-cols-3 gap-2">
                {TARGETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={targets.has(t)}
                    onClick={() => toggle(t)}
                    className={cn(
                      'h-10 rounded-lg border text-sm font-medium transition-colors',
                      targets.has(t)
                        ? 'border-primary bg-accent text-accent-foreground ring-1 ring-primary'
                        : 'hover:bg-muted',
                    )}
                  >
                    {ROLE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <Field label="제목">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="추석 연휴 휴원 안내"
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field label="내용 (선택)">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                rows={6}
                className={cn(inputClass, 'h-auto resize-y py-2')}
              />
            </Field>
            <p className="text-xs text-muted-foreground">학원당 하루 20번까지 보낼 수 있어요.</p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-11" disabled={sending || !title.trim() || targets.size === 0}>
              {sending ? '보내는 중…' : '보내기'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
