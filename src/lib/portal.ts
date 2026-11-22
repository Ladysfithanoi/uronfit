import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_COLUMNS, type Client, type Phase } from '@/lib/clients'
import { featuresOf, tierFor, type Tier } from '@/lib/features'

/**
 * Ngữ cảnh cổng khách hàng. RLS chỉ trả về hồ sơ của chính khách, hoặc các bé của
 * phụ huynh. Phụ huynh nhiều bé chọn bé (lưu ở cookie urg_be); id lạ → rơi về bé đầu tiên.
 */
export const portalContext = cache(async () => {
  const be = (await cookies()).get('urg_be')?.value
  const me = await requirePageRole('client', 'guardian')
  const supabase = await createClient()
  const { data } = await supabase.from('clients').select(CLIENT_COLUMNS).order('full_name')
  const clients = (data ?? []) as Client[]
  const client = clients.find((c) => c.id === be) ?? clients[0] ?? null
  const { data: phases } = client
    ? await supabase.from('phases').select('*').eq('client_id', client.id).order('sort_order')
    : { data: [] }
  // Gói dịch vụ của hồ sơ đang xem → tính năng được dùng (RLS cũng chặn ở database)
  const { data: tiers } = await supabase.from('service_tiers').select('*').order('sort_order')
  const tier = client ? tierFor(client.tier_id, (tiers ?? []) as Tier[]) : null
  const features = featuresOf(tier, (tiers ?? []).length > 0)
  return { me, clients, client, phases: (phases ?? []) as Phase[], tier, features }
})

/** Id các giáo án ĐÃ CHIA SẺ mà khách xem được: cá nhân (theo giai đoạn) + nhóm */
export async function sharedPlanIds(clientId: string, phaseIds: string[]) {
  const supabase = await createClient()
  const [{ data: own }, { data: groups }] = await Promise.all([
    phaseIds.length ? supabase.from('workout_plans').select('id, name, phase_id, group_id').in('phase_id', phaseIds).not('shared_at', 'is', null).order('created_at')
      : Promise.resolve({ data: [] as { id: string; name: string; phase_id: string | null; group_id: string | null }[] }),
    supabase.from('group_members').select('group_id').eq('client_id', clientId),
  ])
  const gids = (groups ?? []).map((g) => g.group_id)
  const { data: gp } = gids.length
    ? await supabase.from('workout_plans').select('id, name, phase_id, group_id').in('group_id', gids).not('shared_at', 'is', null).order('created_at')
    : { data: [] as { id: string; name: string; phase_id: string | null; group_id: string | null }[] }
  return [...(own ?? []), ...(gp ?? [])]
}
