import type { Metadata } from 'next'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { StaffManager } from './StaffManager'

export const metadata: Metadata = { title: 'Nhân sự' }

export default async function StaffPage() {
  await requirePageRole('fm')
  const supabase = await createClient()
  const [{ data: pts }, { data: clients }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone, is_active, created_at').eq('role', 'pt').order('full_name'),
    supabase.from('clients').select('pt_id, status'),
  ])
  const counts = new Map<string, number>()
  for (const c of clients ?? []) if (c.pt_id && c.status === 'active') counts.set(c.pt_id, (counts.get(c.pt_id) ?? 0) + 1)

  return (
    <>
      <PageHeader eyebrow="Quản lý phòng tập" title="Huấn luyện viên"
        description="Tạo tài khoản PT. PT nhận email mời và đăng nhập bằng mã gửi qua email." />
      <StaffManager pts={(pts ?? []).map((p) => ({ ...p, clients: counts.get(p.id) ?? 0 }))} />
    </>
  )
}
