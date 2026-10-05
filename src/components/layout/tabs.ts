import { Bell, BookOpen, ClipboardCheck, Home, Settings, type LucideIcon } from 'lucide-react'

export type TabKey = 'home' | 'attendance' | 'classes' | 'notices' | 'settings'

export type TabDef = {
  key: TabKey
  path: string
  label: string
  icon: LucideIcon
  /** 게스트 둘러보기에서도 열 수 있는 탭 */
  guest: boolean
}

export const TABS: TabDef[] = [
  { key: 'home', path: '/', label: '홈', icon: Home, guest: true },
  { key: 'attendance', path: '/attendance', label: '출석', icon: ClipboardCheck, guest: false },
  { key: 'classes', path: '/classes', label: '수업', icon: BookOpen, guest: false },
  { key: 'notices', path: '/notices', label: '알림', icon: Bell, guest: false },
  { key: 'settings', path: '/settings', label: '설정', icon: Settings, guest: true },
]

/** 주소 → 활성 탭. 하위 페이지(예: /announcements)는 홈 탭에 속한다 */
export function tabFromPath(pathname: string): TabDef {
  return TABS.find((tab) => tab.path !== '/' && pathname.startsWith(tab.path)) ?? TABS[0]
}
