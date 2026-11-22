import type { Metadata } from 'next'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import type { Tier } from '@/lib/features'
import { TierManager } from './TierManager'

export const metadata: Metadata = { title: 'Gói dịch vụ' }

export default async function TiersPage() {
  await requirePageRole('fm')
  const supabase = await createClient()
  const [{ data: tiers }, { data: clients }] = await Promise.all([
    supabase.from('service_tiers').select('*').order('sort_order'),
    supabase.from('clients').select('tier_id').eq('status', 'active'),
  ])
  const list = (tiers ?? []) as Tier[]
  const def = list.find((t) => t.is_default)?.id
  const counts: Record<string, number> = {}
  for (const c of clients ?? []) { const k = c.tier_id ?? def; if (k) counts[k] = (counts[k] ?? 0) + 1 }

  return (
    <>
      <PageHeader eyebrow="Quản lý phòng tập" title="Gói dịch vụ"
        description="Chọn tính năng khách được dùng theo từng gói. Tắt tính năng nào thì khách của gói đó không dùng được nữa — áp dụng ngay, chặn cả ở dữ liệu. HLV không bị ảnh hưởng." />
      <TierManager tiers={list} counts={counts} />
    </>
  )
}
