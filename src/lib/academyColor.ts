/**
 * 학원이 여러 곳일 때 학원마다 붙이는 구분 색 (차트 색 토큰, 라이트·다크 자동 전환).
 * 글씨 배경이 아니라 점·띠로만 쓴다. 학원 id 순서로 정해서 화면마다 같은 학원은 같은 색이다.
 */
export type AcademyTone = { dot: string; stripe: string }

const TONES: AcademyTone[] = [
  { dot: 'bg-chart-1', stripe: 'border-l-chart-1' },
  { dot: 'bg-chart-2', stripe: 'border-l-chart-2' },
  { dot: 'bg-chart-4', stripe: 'border-l-chart-4' },
  { dot: 'bg-chart-5', stripe: 'border-l-chart-5' },
  { dot: 'bg-chart-3', stripe: 'border-l-chart-3' },
]

/** 학원 id 목록 → id 별 색. 학원이 하나뿐이면 빈 Map (구분할 필요 없음) */
export function academyTones(ids: number[]): Map<number, AcademyTone> {
  const unique = [...new Set(ids)].sort((a, b) => a - b)
  if (unique.length < 2) return new Map()
  return new Map(unique.map((id, i) => [id, TONES[i % TONES.length]]))
}
