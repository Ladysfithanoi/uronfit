import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadPlan } from '@/lib/plans'
import { PlanEditor, type Member } from '@/components/plans/PlanEditor'

export const metadata: Metadata = { title: 'Giáo án' }

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePageRole('fm', 'pt')
  const plan = await loadPlan(id)
  if (!plan) notFound()
  const supabase = await createClient()

  let members: Member[] = []
  let back = { href: '/thu-vien/mau', label: 'Mẫu giáo án' }
  let context = 'Mẫu giáo án'
  if (plan.phase_id) {
    const { data } = await supabase.from('phases').select('name, clients(id, full_name, health_flags)').eq('id', plan.phase_id).single()
    const c = data?.clients as unknown as { id: string; full_name: string; health_flags: string[] } | null
    if (c) { members = [{ id: c.id, full_name: c.full_name, health_flags: c.health_flags }]; back = { href: `/khach-hang/${c.id}?tab=giao-an`, label: c.full_name }; context = `${c.full_name} · ${data?.name}` }
  } else if (plan.group_id) {
    const { data } = await supabase.from('groups').select('id, name, group_members(clients(id, full_name, health_flags))').eq('id', plan.group_id).single()
    members = (data?.group_members ?? []).flatMap((m) => { const c = m.clients as unknown as Member | null; return c ? [c] : [] })
    back = { href: `/nhom/${plan.group_id}`, label: data?.name ?? 'Nhóm' }; context = `Nhóm · ${data?.name}`
  }
  const { data: library } = await supabase.from('exercises').select('id, name, muscle_group, equipment, contraindications').order('name')

  return (
    <>
      <Link href={back.href} className="no-print mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> {back.label}</Link>
      <PlanEditor plan={plan} context={context} members={members} library={library ?? []} isGroup={!!plan.group_id} />
    </>
  )
}
