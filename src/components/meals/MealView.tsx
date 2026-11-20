import { cn } from '@/lib/utils'
import { sortMeals, type Meal, type MealPlan } from '@/lib/meals'

export function MacroTargets({ plan, className }: { plan: Pick<MealPlan, 'kcal' | 'protein_g' | 'carb_g' | 'fat_g'>; className?: string }) {
  const items: [string, number | null, string][] = [
    ['Calo', plan.kcal, 'kcal'], ['Đạm', plan.protein_g, 'g'], ['Tinh bột', plan.carb_g, 'g'], ['Béo', plan.fat_g, 'g'],
  ]
  return (
    <div className={cn('grid grid-cols-4 gap-2', className)}>
      {items.map(([l, v, u]) => (
        <div key={l} className="rounded-lg border border-border bg-card p-2 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</p>
          <p className={cn('text-lg font-bold', l === 'Calo' && 'text-brand')}>{v ?? '—'}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{v !== null && u}</span></p>
        </div>
      ))}
    </div>
  )
}

/** Các bữa trong một ngày, gom theo bữa; tổng calo ngày so với mục tiêu */
export function DayMeals({ meals, target, onEdit }: { meals: Meal[]; target: number | null; onEdit?: (m: Meal) => void }) {
  const sorted = sortMeals(meals)
  const slots = [...new Set(sorted.map((m) => m.meal_slot))]
  const total = meals.reduce((s, m) => s + (m.kcal ?? 0), 0)
  if (!meals.length) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Chưa có món nào cho ngày này.</p>
  return (
    <div className="space-y-3">
      {slots.map((slot) => (
        <section key={slot} className="break-inside-avoid rounded-xl border border-border bg-card p-4">
          <h3 className="label-caps mb-2 text-brand">{slot}</h3>
          <ul className="divide-y divide-border">
            {sorted.filter((m) => m.meal_slot === slot).map((m) => {
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.dish}</span>
                    {m.portion && <span className="block text-sm text-muted-foreground">{m.portion}</span>}
                    {m.notes && <span className="block text-xs text-muted-foreground">↳ {m.notes}</span>}
                  </span>
                  {m.kcal !== null && <span className="shrink-0 text-sm font-semibold">{m.kcal} kcal</span>}
                </>
              )
              return (
                <li key={m.id}>
                  {onEdit
                    ? <button type="button" onClick={() => onEdit(m)} className="flex min-h-12 w-full items-start gap-3 py-2 text-left">{body}</button>
                    : <div className="flex items-start gap-3 py-2">{body}</div>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="text-right text-sm text-muted-foreground">
        Tổng ngày: <b className="text-foreground">{total} kcal</b>{target ? <> / mục tiêu {target} kcal</> : null}
      </p>
    </div>
  )
}
