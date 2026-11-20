import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, UsersRound } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { ClientList, type ListClient } from './ClientList'

export const metadata: Metadata = { title: 'Khách hàng' }

export default async function ClientsPage() {
  const me = await requirePageRole('fm', 'pt')
  const supabase = await createClient()
  const [{ data: clients }, { data: pts }] = await Promise.all([
    supabase.from('clients')
      .select('id, full_name, phone, gender, goals, training_type, status, pt_id, is_kid, client_packages(total_sessions, used_sessions, is_active, start_date)')
      .order('full_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'pt').order('full_name'),
  ])

  return (
    <>
      <PageHeader eyebrow={me.role === 'fm' ? 'Toàn bộ phòng tập' : 'Khách tôi phụ trách'} title="Khách hàng"
        action={
          <div className="flex gap-2">
            {me.role === 'fm' && (
              <Link href="/nhom" className={buttonVariants({ variant: 'outline' })}><UsersRound /> <span className="hidden sm:inline">Nhóm</span></Link>
            )}
            <Link href="/khach-hang/moi" className={buttonVariants()}><Plus /> <span className="hidden sm:inline">Thêm khách</span></Link>
          </div>
        } />
      <ClientList clients={(clients ?? []) as ListClient[]} pts={pts ?? []} isFm={me.role === 'fm'} />
    </>
  )
}
