import { useContext } from 'react'

import { UnreadContext } from '@/contexts/unreadContext'

export function useUnread() {
  return useContext(UnreadContext)
}
