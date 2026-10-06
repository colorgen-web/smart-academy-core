import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL, type ApprovalStatus } from '@/lib/academies'
import { cn } from '@/lib/utils'

const TONE: Record<ApprovalStatus, string> = {
  pending: 'bg-warning/25 text-warning-foreground dark:text-warning',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/10 text-destructive',
}

export function StatusBadge({ status, className }: { status: ApprovalStatus; className?: string }) {
  return <Badge className={cn('border-transparent', TONE[status], className)}>{STATUS_LABEL[status]}</Badge>
}
