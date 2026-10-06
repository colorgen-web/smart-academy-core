import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createAnnouncement } from '@/lib/announcements'
import { inputClass } from '@/lib/styles'

const TITLE_MAX = 200

/** 관리자 공지 작성 (권한은 DB RLS 가 한 번 더 검사) */
export function AnnouncementWritePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('제목을 입력해 주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const id = await createAnnouncement({ title: trimmed, content: content.trim(), is_pinned: pinned })
      navigate(`/announcements/${id}`, { replace: true })
    } catch {
      setError('저장하지 못했어요. 관리자 권한이 있는지 확인해 주세요.')
      setSaving(false)
    }
  }

  const fieldClass = `${inputClass} h-auto py-2`

  return (
    <div>
      <PageHeader title="공지 작성" backTo="/announcements" />
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">제목</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                placeholder="공지 제목"
                className={fieldClass}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">내용</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                placeholder="공지 내용"
                className={`${fieldClass} resize-y`}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="size-4 accent-primary"
              />
              목록 맨 위에 고정
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-11" disabled={saving}>
              {saving ? '저장 중…' : '등록하기'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
