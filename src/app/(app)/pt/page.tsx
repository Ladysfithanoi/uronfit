import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarCheck, ClipboardX, Ruler, TriangleAlert, ChevronRight } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { PagedList } from '@/components/ui/pagination'
import { activePackage, currentPhase, type Package, type Phase } from '@/lib/clients'
import { formatDate, todayVN } from '@/lib/date'

export const metadata: Metadata = { title: 'Hôm nay' }

const REMEASURE_DAYS = 14

export default async function PtHome() {
  const me = await requirePageRole('pt')
  const supabase = await createClient()
  const today = todayVN()

  // RLS: chỉ khách PT này phụ trách (trực tiếp hoặc qua nhóm)
  const { data } = await supabase.from('clients')
    .select('id, full_name, status, client_packages(*), phases(*), measurements(measured_on)')
    .eq('status', 'active').order('full_name')
  const clients = (data ?? []) as unknown as { id: string; full_name: string; client_packages: Package[]; phases: Phase[]; measurements: { measured_on: string }[] }[]

  const phaseIds = clients.flatMap((c) => { const p = currentPhase(c.phases, today); return p ? [p.id] : [] })
  const [{ data: phasePlans }, { data: todaySessions }] = await Promise.all([
    phaseIds.length ? supabase.from('workout_plans').select('phase_id').in('phase_id', phaseIds) : Promise.resolve({ data: [] as { phase_id: string | null }[] }),
    supabase.from('workout_sessions')
      .select('id, title, day_order, week, completed_at, workout_plans(id, name, phase_id, group_id, phases(clients(id, full_name)), groups(id, name))')
      .eq('scheduled_date', today),
  ])
  const withPlan = new Set((phasePlans ?? []).map((p) => p.phase_id))

  const lowPackage = clients.flatMap((c) => { const p = activePackage(c.client_packages); const left = p ? p.total_sessions - p.used_sessions : null; return left !== null && left <= 3 ? [{ c, left }] : [] })
  const dueMeasure = clients.flatMap((c) => {
    const last = c.measurements.map((m) => m.measured_on).sort().at(-1) ?? null
    const days = last ? Math.floor((Date.parse(today) - Date.parse(last)) / 86400000) : null
    return days === null || days >= REMEASURE_DAYS ? [{ c, last, days }] : []
  })
  const noPlan = clients.flatMap((c) => { const p = currentPhase(c.phases, today); return !p || !withPlan.has(p.id) ? [{ c, phase: p }] : [] })
  const sessionsToday = (todaySessions ?? []).map((s) => {
    const plan = s.workout_plans as unknown as { id: string; name: string; group_id: string | null; phases: { clients: { id: string; full_name: string } | null } | null; groups: { id: string; name: string } | null } | null
    return { s, plan, who: plan?.groups?.name ?? plan?.phases?.clients?.full_name ?? '—' }
  }).filter((x) => x.plan)

  return (
    <>
      <PageHeader eyebrow={formatDate(today)} title={`Xin chào, ${me.full_name}`} description={`Bạn đang phụ trách ${clients.length} khách đang tập.`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel icon={<CalendarCheck className="size-4 text-brand" />} title="Khách hôm nay" count={sessionsToday.length} empty="Không có buổi nào đặt lịch hôm nay.">
          {sessionsToday.map(({ s, plan, who }) => (
            <Row key={s.id} href={`/giao-an/${plan!.id}`} title={who} sub={`${s.title || `Buổi ${s.day_order}`} · Tuần ${s.week}`} tag={s.completed_at ? 'Đã xong' : undefined} />
          ))}
        </Panel>
        <Panel icon={<TriangleAlert className="size-4 text-warning" />} title="Sắp hết buổi (≤ 3)" count={lowPackage.length} empty="Không có khách sắp hết gói.">
          {lowPackage.map(({ c, left }) => <Row key={c.id} href={`/khach-hang/${c.id}`} title={c.full_name} sub={`Còn ${left} buổi`} warn />)}
        </Panel>
        <Panel icon={<Ruler className="size-4 text-brand" />} title={`Đến hạn đo lại (≥ ${REMEASURE_DAYS} ngày)`} count={dueMeasure.length} empty="Mọi khách đã được đo gần đây.">
          {dueMeasure.map(({ c, last, days }) => <Row key={c.id} href={`/khach-hang/${c.id}?tab=chi-so`} title={c.full_name} sub={last ? `Lần đo cuối ${formatDate(last)} · ${days} ngày trước` : 'Chưa đo lần nào'} />)}
        </Panel>
        <Panel icon={<ClipboardX className="size-4 text-brand" />} title="Chưa có giáo án giai đoạn hiện tại" count={noPlan.length} empty="Mọi khách đã có giáo án.">
          {noPlan.map(({ c, phase }) => <Row key={c.id} href={`/khach-hang/${c.id}?tab=${phase ? 'giao-an' : 'lo-trinh'}`} title={c.full_name} sub={phase ? phase.name : 'Chưa có lộ trình'} />)}
        </Panel>
      </div>
    </>
  )
}

function Panel({ icon, title, count, empty, children }: { icon: React.ReactNode; title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">{icon}<span className="flex-1">{title}</span><span className="rounded-full bg-secondary px-2 text-xs">{count}</span></h2>
      {count ? <PagedList size={5} label="khách" className="divide-y divide-border">{children}</PagedList> : <p className="py-2 text-sm text-muted-foreground">{empty}</p>}
    </section>
  )
}

function Row({ href, title, sub, tag, warn }: { href: string; title: string; sub: string; tag?: string; warn?: boolean }) {
  return (
    <li>
      <Link href={href} className="flex min-h-12 items-center gap-2 py-2">
        <span className="flex-1"><span className="block text-sm font-medium">{title}</span><span className={`block text-xs ${warn ? 'text-warning' : 'text-muted-foreground'}`}>{sub}</span></span>
        {tag && <span className="text-xs text-success">{tag}</span>}
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </li>
  )
}
