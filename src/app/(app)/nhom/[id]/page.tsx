import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { NewPlanDialog } from '@/components/plans/NewPlanDialog'
import { PlanLink } from '@/app/(app)/khach-hang/[id]/tabs/WorkoutTab'
import { activePackage, type Package } from '@/lib/clients'
import { GroupForm } from '../GroupForm'
import { DeleteGroup } from './DeleteGroup'

export const metadata: Metadata = { title: 'Nhóm tập' }

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requirePageRole('fm', 'pt')
  const supabase = await createClient()
  const { data: g } = await supabase.from('groups')
    .select('id, name, type, pt_id, group_members(client_id, clients(id, full_name, is_kid, client_packages(*)))').eq('id', id).maybeSingle()
  if (!g) notFound()
  const members = (g.group_members ?? []).flatMap((m) => {
    const c = m.clients as unknown as { id: string; full_name: string; is_kid: boolean; client_packages: Package[] } | null
    return c ? [c] : []
  })
  const [{ data: plans }, { data: templates }, { data: clients }, { data: pts }] = await Promise.all([
    supabase.from('workout_plans').select('id, name, shared_at, workout_sessions(id, completed_at, attendance(client_id, present))').eq('group_id', id).order('created_at'),
    supabase.from('workout_plans').select('id, name').eq('is_template', true).order('name'),
    supabase.from('clients').select('id, full_name, is_kid, training_type, pt_id').eq('status', 'active').order('full_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'pt').eq('is_active', true).order('full_name'),
  ])
  const sessions = (plans ?? []).flatMap((p) => p.workout_sessions ?? [])

  return (
    <>
      <Link href="/nhom" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Nhóm tập</Link>
      <PageHeader eyebrow={g.type === 'kids' ? 'Nhóm trẻ em' : 'Nhóm 1:2'} title={g.name}
        action={<GroupForm clients={clients ?? []} pts={pts ?? []} isFm={me.role === 'fm'} meId={me.id}
          group={{ id: g.id, name: g.name, type: g.type, pt_id: g.pt_id, memberIds: members.map((m) => m.id) }} />} />

      <section className="mb-6">
        <p className="label-caps mb-2">Thành viên · điểm danh & gói tập tính riêng</p>
        <ul className="grid gap-2 md:grid-cols-3">
          {members.map((m) => {
            const present = sessions.filter((s) => (s.attendance ?? []).some((a) => a.client_id === m.id && a.present)).length
            const pkg = activePackage(m.client_packages)
            const left = pkg ? pkg.total_sessions - pkg.used_sessions : null
            return (
              <li key={m.id}>
                <Link href={`/khach-hang/${m.id}`} className="block rounded-xl border border-border bg-card p-4 hover:bg-secondary">
                  <p className="font-semibold">{m.full_name}</p>
                  <p className="text-sm text-muted-foreground">Có mặt {present}/{sessions.length} buổi</p>
                  {left !== null && <p className={`text-sm ${left <= 3 ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>Gói còn {left} buổi</p>}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="label-caps">Giáo án dùng chung</p>
          <NewPlanDialog kind="workout" groupId={g.id} templates={templates ?? []} />
        </div>
        <ul className="space-y-2">
          {(plans ?? []).map((p) => <PlanLink key={p.id} href={`/giao-an/${p.id}`} name={p.name} shared={!!p.shared_at} sessions={p.workout_sessions ?? []} />)}
          {!plans?.length && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Chưa có giáo án cho nhóm.</p>}
        </ul>
      </section>

      <div className="mt-8"><DeleteGroup id={g.id} name={g.name} /></div>
    </>
  )
}
