import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Field({ label, htmlFor, hint, className, children }: {
  label: string; htmlFor?: string; hint?: string; className?: string; children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Nhóm nút chọn (chip) — chọn một hoặc nhiều, nút cao 44px. */
export function ChipGroup<T extends string>({ options, value, onChange, multiple }: {
  options: { value: T; label: string }[]
  value: T[]
  onChange: (v: T[]) => void
  multiple?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button key={o.value} type="button" aria-pressed={on}
            onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
            className={cn('min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
              on ? 'border-brand bg-brand/15 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
