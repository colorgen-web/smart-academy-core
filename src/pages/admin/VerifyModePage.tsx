import { Database, FlaskConical, LogOut, RotateCcw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PERSONAS, startVerifyMode, stopVerifyMode, switchPersona, useVerifySetting } from '@/verify/mode'

/** 운영자: 검증 모드 켜기·역할 바꾸기·데이터 초기화·끝내기 */
export function VerifyModePage() {
  const navigate = useNavigate()
  const setting = useVerifySetting()
  const [resetting, setResetting] = useState(false)

  const reset = async () => {
    if (!window.confirm('검증 데이터를 모두 지우고 샘플 데이터로 다시 시작할까요? (실제 서비스 데이터는 그대로예요)')) return
    setResetting(true)
    const { resetVerifyDb } = await import('@/verify/localDb')
    await resetVerifyDb()
    switchPersona('admin')
    window.location.assign('/')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="검증 모드" backTo="/settings" />

      <Card>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
          <p className="flex items-center gap-2 font-semibold">
            <FlaskConical className="size-4 text-primary" />
            실제 데이터를 건드리지 않고 기능을 확인해요
          </p>
          <ul className="flex flex-col gap-1.5 text-muted-foreground">
            <li className="flex gap-2">
              <Database className="mt-0.5 size-4 shrink-0" />
              <span>
                켜면 이 기기 브라우저 안의 검증용 데이터베이스만 써요. 실제 서비스와 같은 규칙(권한·함수·알림)으로 동작하지만
                실제 회원·학원 데이터에는 아무것도 저장되지 않아요.
              </span>
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <span>
                운영자·원장·강사·학부모·학생 역할을 바꿔 가며 가입 → 승인 → 반·출석 → 이해도 → 알림 흐름을 혼자 확인할 수
                있어요. 샘플 학원·반·학생·지난 출석이 미리 들어 있어요.
              </span>
            </li>
            <li className="flex gap-2">
              <RotateCcw className="mt-0.5 size-4 shrink-0" />
              <span>검증 데이터는 이 기기에 남아요. 언제든 샘플 데이터로 초기화할 수 있어요. 문자 인증번호는 123456 이에요.</span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">처음 켤 때 검증용 데이터베이스(약 10MB)를 내려받아요.</p>
        </CardContent>
      </Card>

      {!setting.on ? (
        <Button
          size="lg"
          className="h-11"
          onClick={() => {
            startVerifyMode('admin')
            navigate('/', { replace: true })
          }}
        >
          <FlaskConical data-icon="inline-start" />
          검증 모드 시작
        </Button>
      ) : (
        <>
          <Card size="sm">
            <CardHeader>
              <CardTitle>어떤 역할로 볼까요?</CardTitle>
            </CardHeader>
            <CardContent>
              <div role="radiogroup" aria-label="역할" className="flex flex-col gap-1.5">
                {PERSONAS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    role="radio"
                    aria-checked={setting.persona === p.key}
                    onClick={() => {
                      switchPersona(p.key)
                      navigate('/', { replace: true })
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ring-1 transition-colors',
                      setting.persona === p.key ? 'bg-primary/10 ring-2 ring-primary' : 'ring-foreground/10 hover:bg-muted/60',
                    )}
                  >
                    <span className="w-28 shrink-0 text-muted-foreground">{p.role}</span>
                    <span className="font-medium">{p.name}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" size="lg" className="h-11" onClick={reset} disabled={resetting}>
            <RotateCcw data-icon="inline-start" />
            {resetting ? '초기화 중…' : '샘플 데이터로 초기화'}
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              stopVerifyMode()
              navigate('/settings', { replace: true })
            }}
          >
            <LogOut data-icon="inline-start" />
            검증 모드 끝내기
          </Button>
        </>
      )}
    </div>
  )
}
