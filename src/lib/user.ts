import type { User } from '@supabase/supabase-js'

const PROVIDER_LABEL: Record<string, string> = {
  kakao: '카카오',
  naver: '네이버',
}

/** 화면 표시용 사용자 정보 (카카오/네이버 메타데이터 형식 차이를 흡수) */
export function getUserProfile(user: User) {
  const meta = user.user_metadata
  const provider: string = meta.provider ?? user.app_metadata.provider ?? ''
  return {
    name: (meta.name ?? meta.full_name ?? meta.nickname ?? user.email ?? '회원') as string,
    email: user.email,
    avatarUrl: meta.avatar_url as string | undefined,
    providerLabel: PROVIDER_LABEL[provider] ?? provider,
  }
}
