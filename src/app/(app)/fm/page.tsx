import type { Metadata } from 'next'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { GOAL_LABEL, TRAINING_TYPE_LABEL } from '@/lib/labels'
import type { GoalGroup, TrainingType } from '@/lib/types'

export const metadata: Metadata = { title: 'Tổng quan' }

export default async function FmHome() {
  const me = await requirePageRole('fm')
  const supabase = await createClient()

  const [{ data: clients }, { data: pts }] = await Promise.all([
    supabase.from('clients').select('id, status, goals, training_type, pt_id'),
    supabase.from('profiles').select('id, full_name').eq('role', 'pt').eq('is_active', true).order('full_name'),
  ])
  const active = (clients ?? []).filter((c) => c.status === 'active')

  const byGoal = new Map<GoalGroup, number>()
  const byType = new Map<TrainingType, number>()
  for (const c of active) {
    for (const g of c.goals as GoalGroup[]) byGoal.set(g, (byGoal.get(g) ?? 0) + 1)
    byType.set(c.training_type, (byType.get(c.training_type) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader eyebrow="Quản lý phòng tập" title={`Xin chào, ${me.full_name}`}
        description="Bảng tổng quan đầy đủ sẽ hoàn thiện ở Bước 6." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Khách đang tập" value={active.length} accent />
        <Stat label="Tổng hồ sơ khách" value={clients?.length ?? 0} />
        <Stat label="Huấn luyện viên" value={pts?.length ?? 0} />
        <Stat label="Khách trẻ em" value={byGoal.get('kids') ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Breakdown title="Theo PT" rows={(pts ?? []).map((p) => [p.full_name, active.filter((c) => c.pt_id === p.id).length])} />
        <Breakdown title="Theo mục tiêu" rows={[...byGoal].map(([g, n]) => [GOAL_LABEL[g], n])} />
        <Breakdown title="Theo hình thức" rows={[...byType].map(([t, n]) => [TRAINING_TYPE_LABEL[t], n])} />
      </div>
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="label-caps">{label}</p>
      <p className={accent ? 'mt-2 text-3xl font-bold text-brand' : 'mt-2 text-3xl font-bold'}>{value}</p>
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="label-caps mb-3">{title}</p>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && <li className="text-muted-foreground">Chưa có dữ liệu</li>}
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-semibold">{v}</span></li>
        ))}
      </ul>
    </div>
  )
}
