import { GraduationCap, Presentation, School, UsersRound, type LucideIcon } from 'lucide-react'

import { MEMBER_TYPE_LABEL, type MemberType } from '@/lib/profile'
import { cn } from '@/lib/utils'

const MEMBER_TYPES: { value: MemberType; icon: LucideIcon; hint: string }[] = [
  { value: 'parent', icon: UsersRound, hint: '자녀 출결·수업 확인' },
  { value: 'student', icon: GraduationCap, hint: '만 14세 이상' },
  { value: 'teacher', icon: Presentation, hint: '학원 승인 후 이용' },
  { value: 'director', icon: School, hint: '학원 승인 후 이용' },
]

/** 회원 유형 선택 (회원가입·회원 정보 수정 공용) */
export function MemberTypePicker({
  value,
  onChange,
}: {
  value: MemberType | null
  onChange: (value: MemberType) => void
}) {
  return (
    <>
      <div role="radiogroup" aria-label="회원 유형" className="grid grid-cols-2 gap-2">
        {MEMBER_TYPES.map(({ value: type, icon: Icon, hint }) => {
          const selected = value === type
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(type)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                selected ? 'border-primary bg-accent text-accent-foreground ring-1 ring-primary' : 'bg-card hover:bg-muted',
              )}
            >
              <Icon className={cn('size-5', selected ? 'text-primary' : 'text-muted-foreground')} />
              <span className="font-semibold">{MEMBER_TYPE_LABEL[type]}</span>
              <span className={cn('text-xs', selected ? 'opacity-80' : 'text-muted-foreground')}>{hint}</span>
            </button>
          )
        })}
      </div>
      {value === 'student' && (
        <p className="text-xs text-muted-foreground">만 14세 미만 학생은 보호자가 학부모로 가입한 뒤 등록해 주세요.</p>
      )}
      {(value === 'teacher' || value === 'director') && (
        <p className="text-xs text-muted-foreground">{MEMBER_TYPE_LABEL[value]} 기능은 학원 승인 후 사용할 수 있어요.</p>
      )}
    </>
  )
}
