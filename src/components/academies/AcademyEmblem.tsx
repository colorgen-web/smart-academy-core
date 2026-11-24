import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { EmblemError, fileToEmblem } from '@/lib/emblem'
import { cn } from '@/lib/utils'

/** 학원 엠블렘. 이미지가 없으면 학원 이름 첫 글자 */
export function AcademyEmblem({
  src,
  name,
  className,
}: {
  src: string | null | undefined
  name: string
  className?: string
}) {
  return src ? (
    <img src={src} alt="" className={cn('size-10 shrink-0 rounded-lg border bg-card object-cover', className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-semibold text-primary',
        className,
      )}
    >
      {name.trim().charAt(0) || '?'}
    </span>
  )
}

/** 엠블렘 고르기: 미리보기 + 이미지 선택/삭제. value 는 data URL */
export function EmblemPicker({
  value,
  name,
  onChange,
  disabled,
}: {
  value: string | null
  name: string
  onChange: (emblem: string | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await fileToEmblem(file))
    } catch (err) {
      setError(err instanceof EmblemError ? err.message : '이미지를 처리하지 못했어요.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <AcademyEmblem src={value} name={name || '학'} className="size-16 text-2xl" />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus data-icon="inline-start" />
            {busy ? '처리 중…' : value ? '이미지 바꾸기' : '이미지 선택'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || busy}
              onClick={() => onChange(null)}
              className="text-muted-foreground"
            >
              <Trash2 data-icon="inline-start" />
              삭제
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-label="엠블렘 이미지 파일"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <p className="text-xs text-muted-foreground">정사각형으로 잘려서 메인 화면 "내 학원"에 보여요. (PNG·JPG·WEBP)</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
