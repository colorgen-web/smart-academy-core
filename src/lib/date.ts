/** 날짜는 모두 한국 시간(Asia/Seoul) 기준 'YYYY-MM-DD' 문자열로 다룬다 */

export const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'] as const
/** 화면에 보여줄 요일 순서 (월~일) */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

const kstFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function todayKST() {
  return kstFormatter.format(new Date())
}

function parse(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function isValidDate(date: string | null): date is string {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parse(date).getTime())
}

export function addDays(date: string, days: number) {
  const d = parse(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 0=일 … 6=토 */
export function weekdayOf(date: string) {
  return parse(date).getUTCDay()
}

/** 그 주 월요일 ~ 일요일 */
export function weekRange(date: string) {
  const offset = (weekdayOf(date) + 6) % 7
  const start = addDays(date, -offset)
  return { start, end: addDays(start, 6) }
}

/** 10월 6일 (화) */
export function formatDayLabel(date: string) {
  const d = parse(date)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY_LABEL[d.getUTCDay()]})`
}

/** '16:00:00' → '16:00' */
export function formatTime(time: string) {
  return time.slice(0, 5)
}

/** 방금 전 / 5분 전 / 3시간 전 / 어제 / 10월 6일 */
export function formatRelative(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const day = kstFormatter.format(new Date(iso))
  if (day === addDays(kstFormatter.format(new Date(now)), -1)) return '어제'
  const [, m, d] = day.split('-').map(Number)
  return `${m}월 ${d}일`
}
