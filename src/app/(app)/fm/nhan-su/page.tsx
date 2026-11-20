import type { Metadata } from 'next'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { StaffManager } from './StaffManager'

export const metadata: Metadata = { title: 'Nhân sự' }

export default async function StaffPage() {
  await requirePageRole('fm')
  const supabase = await createClient()
  const [{ data: pts }, { data: clients }, { data: groups }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone, is_active, created_at').eq('role', 'pt').order('full_name'),
    supabase.from('clients').select('pt_id, status'),
    supabase.from('groups').select('pt_id'),
  ])
  const active = new Map<string, number>(), total = new Map<string, number>(), grp = new Map<string, number>()
  const inc = (m: Map<string, number>, k: string | null) => { if (k) m.set(k, (m.get(k) ?? 0) + 1) }
  for (const c of clients ?? []) { inc(total, c.pt_id); if (c.status === 'active') inc(active, c.pt_id) }
  for (const g of groups ?? []) inc(grp, g.pt_id)

  return (
    <>
      <PageHeader eyebrow="Quản lý phòng tập" title="Huấn luyện viên"
        description="Tạo tài khoản PT. PT nhận email mời và đăng nhập bằng mã gửi qua email." />
      <StaffManager pts={(pts ?? []).map((p) => ({
        ...p, clients: active.get(p.id) ?? 0, totalClients: total.get(p.id) ?? 0, groups: grp.get(p.id) ?? 0,
      }))} />
    </>
  )
}
