import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { GroupForm } from './GroupForm'
import { PagedList } from '@/components/ui/pagination'

export const metadata: Metadata = { title: 'Nhóm tập' }

export default async function GroupsPage() {
  const me = await requirePageRole('fm', 'pt')
  const supabase = await createClient()
  const [{ data: groups }, { data: clients }, { data: pts }] = await Promise.all([
    supabase.from('groups').select('id, name, type, pt_id, group_members(clients(full_name))').order('name'),
    supabase.from('clients').select('id, full_name, is_kid, training_type, pt_id').eq('status', 'active').order('full_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'pt').eq('is_active', true).order('full_name'),
  ])
  const ptName = new Map((pts ?? []).map((p) => [p.id, p.full_name]))

  return (
    <>
      <PageHeader title="Nhóm tập" description="Nhóm 1:2 và nhóm trẻ em (2–3 bé). Giáo án dùng chung, điểm danh từng người."
        action={<GroupForm clients={clients ?? []} pts={pts ?? []} isFm={me.role === 'fm'} meId={me.id} />} />
      <PagedList size={12} label="nhóm" className="grid gap-2 md:grid-cols-2">
        {(groups ?? []).map((g) => (
          <li key={g.id}>
            <Link href={`/nhom/${g.id}`} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-card p-4 hover:bg-secondary">
              <span className="flex-1">
                <span className="block font-semibold">{g.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {g.type === 'kids' ? 'Nhóm trẻ em' : 'Nhóm 1:2'} · {g.pt_id ? ptName.get(g.pt_id) : 'Chưa gán PT'}
                </span>
                <span className="block text-sm text-muted-foreground">{(g.group_members ?? []).map((m) => (m.clients as unknown as { full_name: string } | null)?.full_name).filter(Boolean).join(', ')}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </PagedList>
      {!groups?.length && <p className="text-sm text-muted-foreground">Chưa có nhóm nào.</p>}
    </>
  )
}
