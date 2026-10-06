import { createContext } from 'react'

export type UnreadState = {
  /** 읽지 않은 알림 수 (불러오기 전·게스트는 0) */
  count: number
  refresh: () => void
}

export const UnreadContext = createContext<UnreadState>({ count: 0, refresh: () => {} })
