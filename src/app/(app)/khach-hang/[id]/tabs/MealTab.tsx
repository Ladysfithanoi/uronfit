import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { currentPhase, type Client, type Phase } from '@/lib/clients'
import { todayVN } from '@/lib/date'
import { NewPlanDialog } from '@/components/plans/NewPlanDialog'
import { calcContextFor } from '@/lib/nutrition-server'

export async function MealTab({ client, phases }: { client: Client; phases: Phase[] }) {
  const supabase = await createClient()
  const ids = phases.map((p) => p.id)
  const calc = await calcContextFor(client.id)
  const [{ data: plans }, { data: templates }] = await Promise.all([
    ids.length ? supabase.from('meal_plans').select('id, name, phase_id, shared_at, kcal').in('phase_id', ids).order('created_at')
      : Promise.resolve({ data: [] as { id: string; name: string; phase_id: string | null; shared_at: string | null; kcal: number | null }[] }),
    supabase.from('meal_plans').select('id, name').eq('is_template', true).order('name'),
  ])
  const cur = currentPhase(phases, todayVN())
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Meal plan thuộc từng giai đoạn: mục tiêu calo, đạm, tinh bột, béo và thực đơn theo ngày.</p>
        <NewPlanDialog kind="meal" phases={phases.map((p) => ({ id: p.id, name: p.name }))} defaultPhase={cur?.id} templates={templates ?? []} calc={calc} />
      </div>
      {phases.map((ph) => {
        const list = (plans ?? []).filter((p) => p.phase_id === ph.id)
        return (
          <section key={ph.id}>
            <p className="label-caps mb-2">{ph.name}{cur?.id === ph.id && <span className="text-brand"> · hiện tại</span>}</p>
            {list.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Chưa có thực đơn.</p> : (
              <ul className="space-y-2">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link href={`/thuc-don/${p.id}`} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-card p-4 hover:bg-secondary">
                      <span className="flex-1"><span className="block font-semibold">{p.name}</span>{p.kcal && <span className="text-sm text-muted-foreground">{p.kcal} kcal/ngày</span>}</span>
                      {p.shared_at ? <span className="flex items-center gap-1 text-xs font-semibold text-success"><Check className="size-3.5" /> Đã chia sẻ</span> : <span className="text-xs text-muted-foreground">Chưa chia sẻ</span>}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
