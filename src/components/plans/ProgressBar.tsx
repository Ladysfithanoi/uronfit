import { cn } from '@/lib/utils'

/** Tiến độ giáo án: số buổi đã xong / tổng buổi + thanh phần trăm */
export function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Đã xong <b className="text-foreground">{done}/{total}</b> buổi</span>
        <span className="font-bold">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ giáo án">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
