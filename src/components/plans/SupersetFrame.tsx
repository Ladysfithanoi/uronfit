import { Repeat } from 'lucide-react'
import { SUPERSET_NAME } from '@/lib/superset'

/** Khung bao quanh một nhóm superset: viền hồng bên trái + tiêu đề cách tập */
export function SupersetFrame({ size, rounds, children }: { size: number; rounds: number | null; children: React.ReactNode }) {
  return (
    <div className="break-inside-avoid rounded-lg border-l-2 border-brand bg-brand/5 py-1 pl-2">
      <p className="flex items-center gap-1.5 px-2 pt-1 text-xs font-semibold text-brand">
        <Repeat className="size-3.5" aria-hidden />
        {SUPERSET_NAME[size] ?? 'Superset'}
        <span className="font-normal text-muted-foreground">· tập luân phiên{rounds ? ` ${rounds} vòng` : ''}, nghỉ sau khi xong cả nhóm</span>
      </p>
      {children}
    </div>
  )
}

/** Ô nhãn thứ tự bài: 1, 2… hoặc A, B1, B2… */
export function OrderBadge({ label, superset }: { label: string; superset?: boolean }) {
  return (
    <span className={`mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold ${superset ? 'bg-brand text-black' : 'bg-secondary'}`}>
      {label}
    </span>
  )
}
