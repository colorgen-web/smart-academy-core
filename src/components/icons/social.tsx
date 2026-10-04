import type { SVGProps } from 'react'

export function NaverIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.27 12.84 7.46 0H0v24h7.73V11.16L16.54 24H24V0h-7.73z" />
    </svg>
  )
}

export function KakaoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.82 1.87 5.3 4.7 6.7l-.96 3.53c-.08.31.27.56.54.38l4.2-2.78c.5.05 1 .08 1.52.08 5.52 0 10-3.54 10-7.9S17.52 3 12 3z" />
    </svg>
  )
}
