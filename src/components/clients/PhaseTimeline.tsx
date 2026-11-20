import { formatDate } from '@/lib/date'
import { PHASE_STATUS_LABEL } from '@/lib/labels'
import { currentPhase, type Phase } from '@/lib/clients'
import { todayVN } from '@/lib/date'
import { cn } from '@/lib/utils'

/** Lộ trình dạng dòng thời gian; giai đoạn hiện tại được đánh dấu hồng. */
export function PhaseTimeline({ phases, renderActions }: {
  phases: Phase[]; renderActions?: (p: Phase, index: number) => React.ReactNode
}) {
  if (!phases.length) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Chưa có giai đoạn nào.</p>
  const current = currentPhase(phases, todayVN())
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-6">
      {phases.map((p, i) => {
        const isCurrent = current?.id === p.id
        return (
          <li key={p.id} className="relative">
            <span aria-hidden className={cn('absolute -left-[33px] top-4 size-4 rounded-full border-2',
              isCurrent ? 'border-brand bg-brand shadow-[0_0_0_4px_rgba(253,55,134,0.25)]'
                : p.status === 'completed' ? 'border-muted-foreground bg-muted-foreground' : 'border-border bg-background')} />
            <div className={cn('rounded-xl border bg-card p-4', isCurrent ? 'border-brand' : 'border-border')}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{p.name}</p>
                {isCurrent
                  ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">Hiện tại</span>
                  : <span className="text-xs text-muted-foreground">{PHASE_STATUS_LABEL[p.status]}</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(p.start_date)} – {p.end_date ? formatDate(p.end_date) : 'chưa định'}</p>
              {p.goal && <p className="mt-2 text-sm">{p.goal}</p>}
              {p.targets && <p className="mt-1 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Chỉ tiêu:</span> {p.targets}</p>}
              {renderActions?.(p, i)}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
