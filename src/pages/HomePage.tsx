import type { User } from '@supabase/supabase-js'

import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'

type HomePageProps = {
  user: User
}

const PROVIDER_LABEL: Record<string, string> = {
  kakao: '카카오',
  naver: '네이버',
}

export function HomePage({ user }: HomePageProps) {
  const meta = user.user_metadata
  const name = meta.name ?? meta.full_name ?? meta.nickname ?? user.email ?? '회원'
  const provider = meta.provider ?? user.app_metadata.provider
  const avatar = meta.avatar_url as string | undefined

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      {avatar && <img src={avatar} alt="" className="size-16 rounded-full object-cover" />}
      <h1 className="text-2xl font-semibold tracking-tight">{name}님, 환영해요</h1>
      <p className="text-sm text-muted-foreground">
        {PROVIDER_LABEL[provider] ?? provider} 계정으로 로그인했어요.
      </p>
      <Button variant="outline" onClick={signOut}>
        로그아웃
      </Button>
    </main>
  )
}
