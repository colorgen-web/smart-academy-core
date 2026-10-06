import { useCallback, useEffect, useState } from 'react'

import { fetchMyProfile, type Profile } from '@/lib/profile'

type Loaded = {
  userId: string
  profile: Profile | null
  error: Error | null
}

/**
 * 로그인한 계정의 회원 정보.
 * profile: undefined = 확인 중, null = 회원가입 전, Profile = 가입 완료
 */
export function useProfile(userId: string | undefined) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchMyProfile(userId).then(
      (profile) => !cancelled && setLoaded({ userId, profile, error: null }),
      (error) =>
        !cancelled &&
        setLoaded({ userId, profile: null, error: error instanceof Error ? error : new Error(String(error)) }),
    )
    return () => {
      cancelled = true
    }
  }, [userId, nonce])

  // 다른 계정의 결과나 다시 불러오는 중인 값은 쓰지 않는다
  const current = loaded && loaded.userId === userId ? loaded : null
  const profile = current && !current.error ? current.profile : undefined

  const setProfile = useCallback(
    (next: Profile) => setLoaded({ userId: next.id, profile: next, error: null }),
    [],
  )
  const reload = useCallback(() => {
    setLoaded(null)
    setNonce((n) => n + 1)
  }, [])

  return { profile, error: current?.error ?? null, setProfile, reload }
}
