import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

type PageHeaderProps = {
  title: string
  /** 뒤로 가기 대상. 히스토리가 없으면(주소로 바로 들어온 경우) 이 경로로 간다 */
  backTo: string
  action?: ReactNode
}

/** 하위 페이지 상단: ‹ 뒤로 + 제목 + (선택) 오른쪽 버튼 */
export function PageHeader({ title, backTo, action }: PageHeaderProps) {
  const navigate = useNavigate()
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(backTo, { replace: true })
  }

  return (
    <div className="mb-4 flex items-center gap-1">
      <button
        type="button"
        onClick={goBack}
        aria-label="뒤로"
        className="-ml-2 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-5" />
      </button>
      <h1 className="flex-1 text-xl font-semibold tracking-tight">{title}</h1>
      {action}
    </div>
  )
}
