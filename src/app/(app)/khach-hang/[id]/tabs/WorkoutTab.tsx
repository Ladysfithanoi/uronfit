import Link from 'next/link'
import { ChevronRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { currentPhase, type Client, type Phase } from '@/lib/clients'
import { todayVN } from '@/lib/date'
import { ProgressBar } from '@/components/plans/ProgressBar'
import { NewPlanDialog } from '@/components/plans/NewPlanDialog'

export async function WorkoutTab({ client, phases }: { client: Client; phases: Phase[] }) {
  const supabase = await createClient()
  const phaseIds = phases.map((p) => p.id)
  const [{ data: plans }, { data: templates }, { data: groupPlans }] = await Promise.all([
    phaseIds.length ? supabase.from('workout_plans').select('id, name, phase_id, shared_at, workout_sessions(completed_at)').in('phase_id', phaseIds).order('created_at')
      : Promise.resolve({ data: [] as { id: string; name: string; phase_id: string | null; shared_at: string | null; workout_sessions: { completed_at: string | null }[] }[] }),
    supabase.from('workout_plans').select('id, name').eq('is_template', true).order('name'),
    supabase.from('group_members').select('groups(id, name, workout_plans(id, name, shared_at, workout_sessions(completed_at)))').eq('client_id', client.id),
  ])
  const cur = currentPhase(phases, todayVN())

  const groups = (groupPlans ?? []).flatMap((g) => {
    const grp = g.groups as unknown as { id: string; name: string; workout_plans: { id: string; name: string; shared_at: string | null; workout_sessions: { completed_at: string | null }[] }[] } | null
    return grp ? [grp] : []
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Giáo án thuộc từng giai đoạn, chia theo tuần và buổi.</p>
        <NewPlanDialog kind="workout" phases={phases.map((p) => ({ id: p.id, name: p.name }))} defaultPhase={cur?.id} templates={templates ?? []} />
      </div>
      {phases.map((ph) => {
        const list = (plans ?? []).filter((p) => p.phase_id === ph.id)
        return (
          <section key={ph.id}>
            <p className="label-caps mb-2">{ph.name}{cur?.id === ph.id && <span className="text-brand"> · hiện tại</span>}</p>
            {list.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Chưa có giáo án cho giai đoạn này.</p> : (
              <ul className="space-y-2">{list.map((p) => <PlanLink key={p.id} href={`/giao-an/${p.id}`} name={p.name} shared={!!p.shared_at} sessions={p.workout_sessions} />)}</ul>
            )}
          </section>
        )
      })}
      {groups.map((g) => (
        <section key={g.id}>
          <p className="label-caps mb-2">Nhóm: {g.name}</p>
          <ul className="space-y-2">{g.workout_plans.map((p) => <PlanLink key={p.id} href={`/giao-an/${p.id}`} name={p.name} shared={!!p.shared_at} sessions={p.workout_sessions} />)}</ul>
        </section>
      ))}
      {phases.length === 0 && <p className="text-sm text-muted-foreground">Tạo giai đoạn ở tab Lộ trình trước khi lên giáo án.</p>}
    </div>
  )
}

export function PlanLink({ href, name, shared, sessions }: { href: string; name: string; shared: boolean; sessions: { completed_at: string | null }[] }) {
  const done = sessions.filter((s) => s.completed_at).length
  return (
    <li>
      <Link href={href} className="block rounded-xl border border-border bg-card p-4 hover:bg-secondary">
        <div className="mb-2 flex items-center gap-2">
          <p className="flex-1 font-semibold">{name}</p>
          {shared ? <span className="flex items-center gap-1 text-xs font-semibold text-success"><Check className="size-3.5" /> Đã chia sẻ</span> : <span className="text-xs text-muted-foreground">Chưa chia sẻ</span>}
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
        <ProgressBar done={done} total={sessions.length} />
      </Link>
    </li>
  )
}
