/** 학원 엠블렘: 고른 이미지를 정사각형으로 잘라 256px 로 줄인 data URL 로 만든다 (DB 에 그대로 저장) */

export const EMBLEM_SIZE = 256
/** DB 제한(200,000자)보다 조금 작게 */
export const EMBLEM_MAX_LENGTH = 190_000
/** 원본 파일 크기 제한 */
export const EMBLEM_FILE_MAX = 10 * 1024 * 1024

export class EmblemError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new EmblemError('이미지를 읽지 못했어요. 다른 파일을 골라 주세요.'))
    }
    img.src = url
  })
}

export async function fileToEmblem(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new EmblemError('이미지 파일만 올릴 수 있어요.')
  if (file.size > EMBLEM_FILE_MAX) throw new EmblemError('10MB 이하 이미지만 올릴 수 있어요.')
  const img = await loadImage(file)

  // 가운데를 정사각형으로 잘라 줄인다 (투명 배경은 그대로)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2
  const size = Math.min(EMBLEM_SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new EmblemError('이미지를 처리하지 못했어요.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

  // webp 를 못 만드는 브라우저(구형 Safari)는 png 로 나온다
  for (const [type, quality] of [
    ['image/webp', 0.9],
    ['image/webp', 0.75],
    ['image/png', undefined],
    ['image/jpeg', 0.85],
  ] as const) {
    const url = canvas.toDataURL(type, quality)
    if (url.length <= EMBLEM_MAX_LENGTH && /^data:image\/(png|jpeg|webp);base64,/.test(url)) return url
  }
  throw new EmblemError('이미지가 너무 복잡해요. 다른 이미지를 골라 주세요.')
}
