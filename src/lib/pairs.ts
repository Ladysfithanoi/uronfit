import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type PairInfo = { groupId: string; partners: { id: string; full_name: string }[] }
export type PairCandidate = { id: string; full_name: string; pt_id: string | null }

/** Nhóm 1:2 mà khách đang thuộc về (chỉ trang HLV gọi; RLS lọc theo quyền) */
export async function pairOf(clientId: string): Promise<PairInfo | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('group_members')
    .select('groups!inner(id, type, group_members(clients(id, full_name)))')
    .eq('client_id', clientId).eq('groups.type', 'one_on_two').limit(1).maybeSingle()
  const g = data?.groups as unknown as { id: string; group_members: { clients: { id: string; full_name: string } | null }[] } | undefined
  if (!g) return null
  return { groupId: g.id, partners: g.group_members.flatMap((m) => (m.clients && m.clients.id !== clientId ? [m.clients] : [])) }
}

/** Khách người lớn đang tập, chưa thuộc nhóm 1:2 nào — để chọn làm người thứ 2 */
export async function pairCandidates(excludeId?: string): Promise<PairCandidate[]> {
  const supabase = await createClient()
  const [{ data: clients }, { data: taken }] = await Promise.all([
    supabase.from('clients').select('id, full_name, pt_id').eq('status', 'active').eq('is_kid', false).order('full_name'),
    supabase.from('group_members').select('client_id, groups!inner(type)').eq('groups.type', 'one_on_two'),
  ])
  const used = new Set((taken ?? []).map((m) => m.client_id))
  return (clients ?? []).filter((c) => c.id !== excludeId && !used.has(c.id))
}
