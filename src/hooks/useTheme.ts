import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'academy_theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // 저장소 접근이 막힌 브라우저(사생활 보호 모드 등)는 시스템 설정을 따른다
  }
  return 'system'
}

let current: Theme = readTheme()

function applyTheme() {
  const dark = current === 'dark' || (current === 'system' && darkQuery.matches)
  document.documentElement.classList.toggle('dark', dark)
}

// 시스템 모드일 때 OS 다크모드 변경을 따라간다 (앱 전체에 리스너 하나)
darkQuery.addEventListener('change', () => {
  if (current === 'system') applyTheme()
})
applyTheme()

export function setTheme(next: Theme) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // 저장 실패해도 현재 화면에는 적용된다
  }
  applyTheme()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * 화면 모드(라이트/다크/시스템). <html class="dark"> 로 반영하고 다음 방문을 위해 저장한다.
 * 첫 페인트 전 적용은 index.html 의 인라인 스크립트가 같은 키/규칙으로 처리한다.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  return { theme, setTheme }
}
