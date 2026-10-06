import type { AttendanceStatus } from '@/lib/classes'

/** 출석 상태별 색 면 (DESIGN_SYSTEM 패턴 B: 색 면 + 짝 토큰 글자) */
export const ATTENDANCE_TONE: Record<AttendanceStatus, string> = {
  present: 'bg-success text-success-foreground',
  late: 'bg-warning text-warning-foreground',
  absent: 'bg-destructive text-destructive-foreground',
  excused: 'bg-muted-foreground text-background',
}

/** 옅은 틴트 (기록 목록용, 패턴 C) */
export const ATTENDANCE_TINT: Record<AttendanceStatus, string> = {
  present: 'bg-success/15 text-success',
  late: 'bg-warning/25 text-warning-foreground dark:text-warning',
  absent: 'bg-destructive/10 text-destructive',
  excused: 'bg-muted text-muted-foreground',
}
