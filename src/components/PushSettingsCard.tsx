import { Bell, BellOff, Share } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAsync } from '@/hooks/useAsync'
import { errorMessage } from '@/lib/academies'
import { disablePush, enablePush, getPushStatus, type PushStatus } from '@/lib/push'

const MESSAGE: Partial<Record<PushStatus, string>> = {
  unsupported: '이 브라우저는 푸시 알림을 지원하지 않아요. 크롬·엣지·삼성 인터넷·사파리 최신 버전에서 켤 수 있어요.',
  unconfigured: '푸시 알림은 아직 준비 중이에요.',
  denied: '알림이 차단되어 있어요. 브라우저(또는 휴대폰) 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어 주세요.',
  off: '앱을 닫아 두어도 출석·공지·가입 소식을 이 기기로 바로 알려 드려요.',
  on: '이 기기로 새 알림을 바로 보내 드려요. 다른 기기는 그 기기에서 따로 켜 주세요.',
}

const ENABLE_FAILED =
  '푸시 알림을 켜지 못했어요. 시크릿(비공개) 창이라면 일반 창에서, 아니면 잠시 후 다시 시도해 주세요.'

/** 설정 > 푸시 알림 (이 기기만). 켜기는 버튼을 누를 때만 알림 허용을 묻는다 */
export function PushSettingsCard() {
  const initial = useAsync(getPushStatus, [])
  const [changed, setChanged] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = changed ?? initial.data

  const run = async (action: () => Promise<PushStatus>, fallback: string) => {
    setBusy(true)
    setError(null)
    try {
      setChanged(await action())
    } catch (err) {
      setError(errorMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          푸시 알림
          {status === 'on' && (
            <Badge variant="outline" className="border-success/40 text-success">
              켜짐
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === 'needs-install' ? (
          <div className="flex flex-col gap-1.5 text-sm">
            <p className="text-muted-foreground">
              아이폰·아이패드는 홈 화면에 추가한 앱에서 푸시 알림을 켤 수 있어요 (iOS 16.4 이상).
            </p>
            <p>
              사파리에서 <Share className="inline size-4 align-text-bottom text-primary" aria-label="공유" /> 공유 →{' '}
              <b className="font-semibold">홈 화면에 추가</b>를 누른 뒤, 추가된 앱을 열고 여기서 켜 주세요.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{MESSAGE[status]}</p>
        )}

        {status === 'off' && (
          <Button size="lg" className="h-11" disabled={busy} onClick={() => run(enablePush, ENABLE_FAILED)}>
            <Bell data-icon="inline-start" />
            {busy ? '켜는 중…' : '이 기기에서 푸시 받기'}
          </Button>
        )}
        {status === 'on' && (
          <Button
            variant="outline"
            size="lg"
            className="h-11"
            disabled={busy}
            onClick={() => run(async () => (await disablePush(), 'off'), '끄지 못했어요. 잠시 후 다시 시도해 주세요.')}
          >
            <BellOff data-icon="inline-start" />
            {busy ? '끄는 중…' : '이 기기에서 끄기'}
          </Button>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
