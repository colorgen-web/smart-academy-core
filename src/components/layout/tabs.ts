import { Bell, BookOpen, ClipboardCheck, Home, Settings, type LucideIcon } from 'lucide-react'

export type TabKey = 'home' | 'attendance' | 'classes' | 'notices' | 'settings'

export type TabDef = {
  key: TabKey
  label: string
  icon: LucideIcon
  /** 게스트 둘러보기에서도 열 수 있는 탭 */
  guest: boolean
}

export const TABS: TabDef[] = [
  { key: 'home', label: '홈', icon: Home, guest: true },
  { key: 'attendance', label: '출석', icon: ClipboardCheck, guest: false },
  { key: 'classes', label: '수업', icon: BookOpen, guest: false },
  { key: 'notices', label: '알림', icon: Bell, guest: false },
  { key: 'settings', label: '설정', icon: Settings, guest: true },
]
