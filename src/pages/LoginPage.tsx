import { useState } from 'react'
import { Link } from 'react-router'
import { GraduationCap } from 'lucide-react'

import { KakaoIcon, NaverIcon } from '@/components/icons/social'
import { Button } from '@/components/ui/button'
import { signIn, type SocialProvider } from '@/lib/auth'

type LoginPageProps = {
  onGuest: () => void
  /** 네이버 콜백 실패 등 바깥에서 넘겨주는 오류 */
  error?: string | null
  /** 탈퇴 완료 등 안내 */
  notice?: string | null
}

export function LoginPage({ onGuest, error, notice: outerNotice }: LoginPageProps) {
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<SocialProvider | null>(null)

  const handleSocial = async (provider: SocialProvider) => {
    setNotice(null)
    setPending(provider)
    try {
      // 성공하면 네이버/카카오 인증 페이지로 이동한다
      await signIn(provider)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '로그인에 실패했어요.')
      setPending(null)
    }
  }

  const message = notice ?? error

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl border bg-card p-8 text-card-foreground shadow-sm">
        {outerNotice && (
          <p role="status" className="mb-6 rounded-lg bg-success/15 px-3 py-2 text-center text-sm text-success">
            {outerNotice}
          </p>
        )}
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
            disabled={pending !== null}
            onClick={() => handleSocial('naver')}
          >
            <NaverIcon className="size-4" />
            네이버로 시작하기
          </Button>
          <Button
            size="lg"
            className="h-12 w-full gap-2 bg-[#FEE500] text-[15px] text-black/85 hover:bg-[#FEE500]/90"
            disabled={pending !== null}
            onClick={() => handleSocial('kakao')}
          >
            <KakaoIcon className="size-5" />
            카카오로 시작하기
          </Button>
        </div>

        {message && (
          <p role="alert" className="mt-3 text-center text-sm text-destructive">
            {message}
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
          처음 로그인하면 회원가입 화면에서
          <br />
          <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
            이용약관
          </Link>
          과{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
            개인정보 처리방침
          </Link>
          에 동의를 받아요.
        </p>
      </section>
    </main>
  )
}
