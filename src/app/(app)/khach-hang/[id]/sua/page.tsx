import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pairCandidates, pairOf } from '@/lib/pairs'
import { PageHeader } from '@/components/layout/PageHeader'
import { CLIENT_COLUMNS, activePackage, type Client, type Package } from '@/lib/clients'
import { ClientForm } from '../../ClientForm'

export const metadata: Metadata = { title: 'Sửa hồ sơ' }

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requirePageRole('fm', 'pt')
  const supabase = await createClient()
  const { data: tiers } = await supabase.from('service_tiers').select('id, name, is_default').order('sort_order')
  const [{ data: client }, { data: pkgs }, { data: pts }] = await Promise.all([
    supabase.from('clients').select(CLIENT_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('client_packages').select('*').eq('client_id', id),
    supabase.from('profiles').select('id, full_name').eq('role', 'pt').eq('is_active', true).order('full_name'),
  ])
  if (!client) notFound()
  const [pair, candidates] = await Promise.all([pairOf(id), pairCandidates(id)])
  return (
    <div className="max-w-2xl">
      <Link href={`/khach-hang/${id}`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Hồ sơ khách</Link>
      <PageHeader eyebrow="Sửa hồ sơ" title={(client as Client).full_name} />
      <ClientForm client={client as Client} pkg={activePackage(pkgs as Package[])} pts={pts ?? []} isFm={me.role === 'fm'} meId={me.id} tiers={tiers ?? []} pair={pair} candidates={candidates} />
    </div>
  )
}
