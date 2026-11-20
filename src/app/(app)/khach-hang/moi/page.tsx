import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClientForm } from '../ClientForm'

export const metadata: Metadata = { title: 'Thêm khách' }

export default async function NewClientPage() {
  const me = await requirePageRole('fm', 'pt')
  const supabase = await createClient()
  const { data: pts } = await supabase.from('profiles').select('id, full_name').eq('role', 'pt').eq('is_active', true).order('full_name')
  return (
    <div className="max-w-2xl">
      <Link href="/khach-hang" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Khách hàng</Link>
      <PageHeader eyebrow="Khách hàng" title="Thêm khách mới" />
      <ClientForm pts={pts ?? []} isFm={me.role === 'fm'} meId={me.id} />
    </div>
  )
}
