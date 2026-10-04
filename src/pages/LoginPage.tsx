import { useState } from 'react'
import { GraduationCap } from 'lucide-react'

import { KakaoIcon, NaverIcon } from '@/components/icons/social'
import { Button } from '@/components/ui/button'

export type SocialProvider = 'naver' | 'kakao'

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  naver: '네이버',
  kakao: '카카오',
}

type LoginPageProps = {
  onSocialLogin?: (provider: SocialProvider) => void
  onGuest: () => void
}

export function LoginPage({ onSocialLogin, onGuest }: LoginPageProps) {
  const [notice, setNotice] = useState<string | null>(null)

  const handleSocial = (provider: SocialProvider) => {
    if (onSocialLogin) {
      onSocialLogin(provider)
      return
    }
    // TODO: 네이버/카카오 OAuth 연동 후 onSocialLogin 으로 교체
    setNotice(`${PROVIDER_LABEL[provider]} 로그인은 연동 준비 중이에요.`)
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl border bg-card p-8 text-card-foreground shadow-sm">
        <header className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Smart Academy</h1>
          <p className="text-sm text-muted-foreground">
            간편하게 로그인하고 학습을 시작하세요
          </p>
        </header>

        <div className="flex flex-col gap-2.5">
          <Button
            size="lg"
            className="h-12 w-full gap-2 bg-[#03C75A] text-[15px] text-white hover:bg-[#03C75A]/90"
            onClick={() => handleSocial('naver')}
          >
            <NaverIcon className="size-4" />
            네이버로 시작하기
          </Button>
          <Button
            size="lg"
            className="h-12 w-full gap-2 bg-[#FEE500] text-[15px] text-black/85 hover:bg-[#FEE500]/90"
            onClick={() => handleSocial('kakao')}
          >
            <KakaoIcon className="size-5" />
            카카오로 시작하기
          </Button>
        </div>

        {notice && (
          <p role="status" className="mt-3 text-center text-sm text-muted-foreground">
            {notice}
          </p>
        )}

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          또는
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          size="lg"
          className="h-12 w-full text-[15px]"
          onClick={onGuest}
        >
          게스트로 둘러보기
        </Button>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          로그인 시 서비스 이용약관 및 개인정보 처리방침에
          <br />
          동의한 것으로 간주합니다.
        </p>
      </section>
    </main>
  )
}
