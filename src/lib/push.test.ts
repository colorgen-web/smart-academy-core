import { describe, expect, it } from 'vitest'

import { isIos, urlBase64ToUint8Array } from '@/lib/push'

describe('urlBase64ToUint8Array', () => {
  it('base64url(패딩 없음)을 바이트로 바꾼다', () => {
    // "-_8" 은 표준 base64 로 "+/8=" → 0xfb 0xff
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([0xfb, 0xff])
    expect([...urlBase64ToUint8Array('AQID')]).toEqual([1, 2, 3])
  })

  it('VAPID 공개키(65바이트)를 그대로 복원한다', () => {
    const bytes = Uint8Array.from({ length: 65 }, (_, i) => (i * 37) % 256)
    const key = Buffer.from(bytes).toString('base64url')
    expect(urlBase64ToUint8Array(key)).toEqual(bytes)
  })
})

describe('isIos', () => {
  it('아이폰·아이패드를 알아본다', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe(true)
    // 아이패드 사파리는 기본이 데스크톱 모드 (맥처럼 보이지만 터치가 된다)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
  })

  it('맥·안드로이드는 아니다', () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIos('Mozilla/5.0 (Linux; Android 14; SM-S918N)')).toBe(false)
  })
})
