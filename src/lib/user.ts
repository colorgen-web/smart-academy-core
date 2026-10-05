import type { User } from '@supabase/supabase-js'

import { getLoginProvider } from '@/lib/auth'

const PROVIDER_LABEL: Record<string, string> = {
  kakao: '카카오',
  naver: '네이버',
}

/** 화면 표시용 사용자 정보 (카카오/네이버 메타데이터 형식 차이를 흡수) */
export function getUserProfile(user: User) {
  const meta = user.user_metadata
  // 이번 로그인에 쓴 버튼 우선, 없으면 계정을 처음 만든 방식
  const provider: string = getLoginProvider() ?? meta.provider ?? user.app_metadata.provider ?? ''
  return {
    name: (meta.name ?? meta.full_name ?? meta.nickname ?? user.email ?? '회원') as string,
    email: user.email,
    avatarUrl: meta.avatar_url as string | undefined,
    providerLabel: PROVIDER_LABEL[provider] ?? provider,
  }
}
