'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createAccount, setAccountActive } from '@/lib/accounts'
import { run, must } from '@/lib/action'
import { parseDecimal, parseIntOrNull } from '@/lib/num'
import type { ClientStatus, Gender, GoalGroup, TrainingType } from '@/lib/types'

export type ClientInput = {
  full_name: string; gender: Gender; birth_date: string | null; phone: string; start_date: string
  goals: GoalGroup[]; training_type: TrainingType; pt_id: string | null; status: ClientStatus
  injuries: string; surgeries: string; joint_conditions: string; doctor_orders: string; avoid_movements: string
  health_flags: string[]; is_kid: boolean; guardian_name: string; guardian_phone: string; height_cm: string; kid_notes: string
  photo_consent: boolean; avatar_path: string | null; tier_id?: string | null
  package_name: string; package_total: string; package_used: string
}

const t = (s: string | null | undefined) => (s?.trim() ? s.trim() : null)

type Db = Awaited<ReturnType<typeof createClient>>

function checkClient(input: ClientInput, who = '') {
  if (!input.full_name?.trim()) throw new HttpError(400, `Vui lòng nhập họ tên${who}.`)
  if (!input.goals.length) throw new HttpError(400, `Chọn ít nhất một nhóm mục tiêu${who}.`)
}

/** Ghi hồ sơ + gói tập. onCreated gọi ngay khi dòng khách được tạo (để hoàn tác nếu bước sau lỗi). */
async function writeClient(supabase: Db, me: { id: string; role: string }, input: ClientInput, id?: string, onCreated?: (id: string) => void) {
  const isKid = input.is_kid || input.goals.includes('kids')
  const row = {
    full_name: input.full_name.trim(), gender: input.gender, birth_date: input.birth_date || null,
    phone: t(input.phone), start_date: input.start_date, goals: input.goals, training_type: input.training_type,
    // PT chỉ tạo khách cho chính mình (RLS cũng chặn)
    pt_id: me.role === 'pt' ? me.id : input.pt_id, status: input.status,
    injuries: t(input.injuries), surgeries: t(input.surgeries), joint_conditions: t(input.joint_conditions),
    doctor_orders: t(input.doctor_orders), avoid_movements: t(input.avoid_movements), health_flags: input.health_flags,
    is_kid: isKid, guardian_name: isKid ? t(input.guardian_name) : null, guardian_phone: isKid ? t(input.guardian_phone) : null,
    height_cm: parseDecimal(input.height_cm), kid_notes: isKid ? t(input.kid_notes) : null,
    photo_consent: input.photo_consent, avatar_path: input.avatar_path,
    // Gói dịch vụ: chỉ FM đặt (trigger ở database cũng chặn PT)
    ...(me.role === 'fm' ? { tier_id: input.tier_id || null } : {}),
  }

  let clientId = id
  if (id) {
    const res = await supabase.from('clients').update(row).eq('id', id).select('id')
    if (!must(res)?.length) throw new HttpError(403, 'Bạn không có quyền sửa hồ sơ này.')
  } else {
    clientId = must(await supabase.from('clients').insert({ ...row, created_by: me.id }).select('id').single()).id
    onCreated?.(clientId!)
  }

  // Gói tập
  const total = parseIntOrNull(input.package_total)
  if (total && total > 0) {
    const used = Math.max(0, parseIntOrNull(input.package_used) ?? 0)
    const { data: pkg } = await supabase.from('client_packages').select('id').eq('client_id', clientId!).eq('is_active', true)
      .order('start_date', { ascending: false }).limit(1).maybeSingle()
    const pkgRow = { name: t(input.package_name) ?? 'Gói tập', total_sessions: total, used_sessions: used }
    if (pkg) must(await supabase.from('client_packages').update(pkgRow).eq('id', pkg.id))
    else must(await supabase.from('client_packages').insert({ ...pkgRow, client_id: clientId! }))
  }
  return clientId!
}

export async function saveClient(input: ClientInput, id?: string) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    checkClient(input)
    const clientId = await writeClient(await createClient(), me, input, id)
    revalidatePath('/khach-hang', 'layout')
    return { id: clientId }
  })
}

// ─── Tập 1:2: người thứ 2 + nhóm ────────────────────────────────────────────
export type PartnerInput = { mode: 'new'; input: ClientInput } | { mode: 'existing'; id: string }

async function inPair(supabase: Db, clientId: string) {
  const rows = must(await supabase.from('group_members').select('client_id, groups!inner(type)').eq('client_id', clientId).eq('groups.type', 'one_on_two'))
  return rows.length > 0
}

const shortName = (n: string) => n.trim().split(/\s+/).pop() ?? n

/** Tạo / gắn người thứ 2 và lập nhóm 1:2. created ghi lại id vừa tạo để hoàn tác khi lỗi. */
async function joinPair(supabase: Db, me: { id: string; role: string }, clientId: string, partner: PartnerInput, created: { clients: string[]; groups: string[] }) {
  const first = must(await supabase.from('clients').select('full_name, pt_id, is_kid').eq('id', clientId).single())
  if (first.is_kid) throw new HttpError(400, 'Khách trẻ em tập theo nhóm trẻ em, không lập nhóm 1:2.')
  if (await inPair(supabase, clientId)) throw new HttpError(409, 'Khách này đã thuộc một nhóm 1:2.')

  let partnerId: string, partnerName: string
  if (partner.mode === 'new') {
    partnerId = await writeClient(supabase, me, { ...partner.input, training_type: 'one_on_two', pt_id: first.pt_id, is_kid: false, avatar_path: null },
      undefined, (id) => created.clients.push(id))
    partnerName = partner.input.full_name
  } else {
    if (partner.id === clientId) throw new HttpError(400, 'Hãy chọn một khách khác làm người thứ 2.')
    const { data: p } = await supabase.from('clients').select('id, full_name, pt_id, is_kid').eq('id', partner.id).maybeSingle()
    if (!p || p.is_kid) throw new HttpError(400, 'Khách được chọn không phù hợp để tập 1:2.')
    if (p.pt_id !== first.pt_id) throw new HttpError(400, 'Hai người tập 1:2 phải cùng PT phụ trách.')
    if (await inPair(supabase, p.id)) throw new HttpError(409, `${p.full_name} đã thuộc một nhóm 1:2 khác.`)
    partnerId = p.id
    partnerName = p.full_name
  }

  const groupId: string = must(await supabase.from('groups').insert({
    name: `1:2 · ${shortName(first.full_name)} & ${shortName(partnerName)}`, type: 'one_on_two', pt_id: first.pt_id,
  }).select('id').single()).id
  created.groups.push(groupId)
  must(await supabase.from('group_members').insert([clientId, partnerId].map((client_id) => ({ group_id: groupId, client_id }))))
  if (partner.mode === 'existing') must(await supabase.from('clients').update({ training_type: 'one_on_two' }).eq('id', partnerId))
  return { partnerId, groupId }
}

/** Lưu khách 1:2 cùng người thứ 2. Lỗi giữa chừng → xoá đúng những dòng vừa tạo trong lần gọi này. */
export async function saveClientPair(input: ClientInput, partner: PartnerInput, id?: string) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    checkClient(input)
    if (partner.mode === 'new') {
      checkClient(partner.input, ' của người thứ 2')
      if (partner.input.goals.includes('kids')) throw new HttpError(400, 'Người thứ 2 không thể thuộc nhóm trẻ em.')
    }
    const supabase = await createClient()
    const created = { clients: [] as string[], groups: [] as string[] }
    try {
      const clientId = await writeClient(supabase, me, { ...input, training_type: 'one_on_two' }, id, (x) => created.clients.push(x))
      const r = await joinPair(supabase, me, clientId, partner, created)
      revalidatePath('/khach-hang', 'layout')
      revalidatePath('/nhom', 'layout')
      return { id: clientId, ...r }
    } catch (e) {
      const admin = createAdminClient()
      if (created.groups.length) await admin.from('groups').delete().in('id', created.groups)
      if (created.clients.length) await admin.from('clients').delete().in('id', created.clients)
      throw e
    }
  })
}

export async function setClientAvatar(clientId: string, path: string) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    if (!path.startsWith(`${clientId}/`)) throw new HttpError(400, 'Đường dẫn ảnh không hợp lệ.')
    const supabase = await createClient()
    must(await supabase.from('clients').update({ avatar_path: path }).eq('id', clientId))
    revalidatePath(`/khach-hang/${clientId}`)
  })
}

/** Gia hạn: kết thúc gói cũ, tạo gói mới */
export async function renewPackage(clientId: string, name: string, total: number) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    if (!(total > 0)) throw new HttpError(400, 'Số buổi phải lớn hơn 0.')
    const supabase = await createClient()
    must(await supabase.from('client_packages').update({ is_active: false }).eq('client_id', clientId).eq('is_active', true))
    must(await supabase.from('client_packages').insert({ client_id: clientId, name: name.trim() || 'Gói tập', total_sessions: total }))
    revalidatePath(`/khach-hang/${clientId}`)
  })
}

/**
 * Xoá hồ sơ khách — CHỈ FM (RLS clients_delete cũng chỉ cho FM).
 * Dọn kèm: ảnh trong kho riêng tư, và khoá tài khoản khách/phụ huynh không còn gắn hồ sơ nào.
 */
async function removeClients(ids: string[]): Promise<number> {
  const unique = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (!unique.length) return 0
  if (unique.length > 200) throw new HttpError(400, 'Mỗi lần xoá tối đa 200 khách.')
  const supabase = await createClient()
  const admin = createAdminClient()

  // Ghi lại tài khoản đang gắn trước khi xoá (client_access sẽ bị xoá theo)
  const { data: access } = await admin.from('client_access').select('profile_id').in('client_id', unique)

  const deleted = must(await supabase.from('clients').delete().in('id', unique).select('id')).map((r) => r.id)
  if (!deleted.length) throw new HttpError(403, 'Không xoá được hồ sơ đã chọn.')

  // Ảnh: {client_id}/avatar-… và {client_id}/progress/…
  for (const id of deleted) {
    const paths: string[] = []
    for (const dir of [id, `${id}/progress`]) {
      const { data: files } = await admin.storage.from('client-media').list(dir, { limit: 1000 })
      for (const f of files ?? []) if (f.id) paths.push(`${dir}/${f.name}`)
    }
    if (paths.length) await admin.storage.from('client-media').remove(paths)
  }

  // Tài khoản không còn gắn hồ sơ nào → khoá (phụ huynh còn bé khác thì giữ)
  for (const pid of new Set((access ?? []).map((a) => a.profile_id))) {
    const { count } = await admin.from('client_access').select('client_id', { count: 'exact', head: true }).eq('profile_id', pid)
    if (!count) await setAccountActive(pid, false)
  }
  return deleted.length
}

export async function deleteClient(clientId: string) {
  return run(async () => {
    await requireApiRole('fm')
    await removeClients([clientId])
    revalidatePath('/khach-hang', 'layout')
  })
}

export async function deleteClients(ids: string[]) {
  return run(async () => {
    await requireApiRole('fm')
    const n = await removeClients(ids)
    revalidatePath('/khach-hang', 'layout')
    return { deleted: n }
  })
}

/** Tạo (hoặc gắn) tài khoản đăng nhập cho khách / phụ huynh của bé */
export async function addClientAccount(clientId: string, input: { email: string; fullName: string; relation: 'self' | 'guardian' }) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    // Kiểm tra quyền bằng chính RLS: chỉ sửa được khách mình quản lý
    const { data: ok } = await supabase.rpc('can_manage_client', { cid: clientId })
    if (!ok) throw new HttpError(403, 'Bạn không có quyền với khách này.')
    if (!input.fullName?.trim()) throw new HttpError(400, 'Vui lòng nhập tên người dùng tài khoản.')

    const role = input.relation === 'guardian' ? 'guardian' : 'client'
    const admin = createAdminClient()
    if (role === 'client') {
      const { count } = await admin.from('client_access').select('profile_id', { count: 'exact', head: true })
        .eq('client_id', clientId).eq('relation', 'self')
      if ((count ?? 0) > 0) throw new HttpError(409, 'Khách này đã có tài khoản riêng.')
    }
    const acc = await createAccount({ email: input.email, fullName: input.fullName, role, createdBy: me })
    if (role === 'client' && acc.reused) {
      const { count } = await admin.from('client_access').select('client_id', { count: 'exact', head: true }).eq('profile_id', acc.id)
      if ((count ?? 0) > 0) throw new HttpError(409, 'Email này đã gắn với hồ sơ khách khác.')
    }
    must(await admin.from('client_access').upsert({ client_id: clientId, profile_id: acc.id, relation: input.relation }))
    revalidatePath(`/khach-hang/${clientId}`)
    return acc
  })
}

/** Gỡ tài khoản khỏi hồ sơ; tài khoản không còn gắn hồ sơ nào thì khoá luôn */
export async function removeClientAccount(clientId: string, profileId: string) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    const { data: ok } = await supabase.rpc('can_manage_client', { cid: clientId })
    if (!ok) throw new HttpError(403, 'Bạn không có quyền với khách này.')
    const admin = createAdminClient()
    must(await admin.from('client_access').delete().eq('client_id', clientId).eq('profile_id', profileId))
    const { count } = await admin.from('client_access').select('client_id', { count: 'exact', head: true }).eq('profile_id', profileId)
    if (!count) await setAccountActive(profileId, false)
    revalidatePath(`/khach-hang/${clientId}`)
  })
}
