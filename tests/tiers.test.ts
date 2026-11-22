/**
 * Gói dịch vụ chặn tính năng khách ở DATABASE (migration 011).
 * Tự tạo dữ liệu tạm "urgym-selftest" và tự dọn — chạy được cả trên project đang dùng thật:
 *   npx vitest run tests/tiers.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function signIn(email: string): Promise<SupabaseClient> {
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.verifyOtp({ email, token: data.properties!.email_otp, type: 'email' })
  if (error) throw error
  return c
}
async function mkUser(email: string, role: string) {
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true })
  await admin.from('profiles').insert({ id: data.user!.id, full_name: email, role, email })
  return data.user!.id
}

const S = 'urgym-selftest-tier'
let ptId = '', khId = '', clientId = '', planId = '', sessionId = '', phaseId = '', metricId = '', basicId = '', customId = ''
let pt: SupabaseClient, kh: SupabaseClient

beforeAll(async () => {
  ptId = await mkUser(`${S}-pt@example.com`, 'pt')
  khId = await mkUser(`${S}-kh@example.com`, 'client')
  basicId = (await admin.from('service_tiers').insert({ name: `${S} cơ bản`, features: ['workout_view', 'meal_view', 'coach_notes'] }).select('id').single()).data!.id
  customId = (await admin.from('service_tiers').insert({ name: `${S} chỉ số`, features: ['metrics_view', 'metrics_entry', 'self_training', 'photos_view'] }).select('id').single()).data!.id
  clientId = (await admin.from('clients').insert({ full_name: S, gender: 'female', pt_id: ptId, tier_id: basicId }).select('id').single()).data!.id
  await admin.from('client_access').insert({ client_id: clientId, profile_id: khId, relation: 'self' })
  phaseId = (await admin.from('phases').insert({ client_id: clientId, name: 'GĐ1', start_date: '2026-11-01', status: 'active' }).select('id').single()).data!.id
  planId = (await admin.from('workout_plans').insert({ name: 'GA', phase_id: phaseId, shared_at: new Date().toISOString() }).select('id').single()).data!.id
  sessionId = (await admin.from('workout_sessions').insert({ plan_id: planId, week: 1, day_order: 1, is_self_training: true }).select('id').single()).data!.id
  await admin.from('meal_plans').insert({ name: 'TĐ', phase_id: phaseId, shared_at: new Date().toISOString() })
  metricId = (await admin.from('metric_types').select('id').eq('name', 'Cân nặng').is('client_id', null).single()).data!.id
  await admin.from('measurements').insert({ client_id: clientId, metric_type_id: metricId, measured_on: '2026-11-10', value_num: 60, source: 'staff' })
  await admin.from('notes').insert({ client_id: clientId, content: 'Nhắn khách', coach_only: false })
  await admin.from('progress_photos').insert({ client_id: clientId, taken_on: '2026-11-10', storage_path: `${clientId}/x.png` })
  kh = await signIn(`${S}-kh@example.com`)
  pt = await signIn(`${S}-pt@example.com`)
})

afterAll(async () => {
  if (clientId) await admin.from('clients').delete().eq('id', clientId)
  for (const id of [basicId, customId]) if (id) await admin.from('service_tiers').delete().eq('id', id)
  for (const id of [ptId, khId]) if (id) await admin.auth.admin.deleteUser(id)
})

const count = async (c: SupabaseClient, t: string, col: string, v: string) => ((await c.from(t).select('id').eq(col, v)).data ?? []).length
const selfMeasure = () => kh.from('measurements').insert({ client_id: clientId, metric_type_id: metricId, measured_on: '2026-11-21', value_num: 59, source: 'client', measured_by: khId })

describe('Gói dịch vụ — chặn ở database', () => {
  it('Gói có giáo án / thực đơn / lời nhắn: chỉ thấy đúng phần đó', async () => {
    await admin.from('clients').update({ tier_id: basicId }).eq('id', clientId)
    expect(await count(kh, 'workout_plans', 'id', planId)).toBe(1)
    expect(await count(kh, 'meal_plans', 'phase_id', phaseId)).toBe(1)
    expect(await count(kh, 'notes', 'client_id', clientId)).toBe(1)
    expect(await count(kh, 'measurements', 'client_id', clientId)).toBe(0)
    expect(await count(kh, 'progress_photos', 'client_id', clientId)).toBe(0)
    expect((await selfMeasure()).error).not.toBeNull()
    expect((await kh.rpc('complete_self_session', { sid: sessionId, done: true })).error).not.toBeNull()
  })

  it('Đổi gói: quyền đổi theo ngay', async () => {
    await admin.from('clients').update({ tier_id: customId }).eq('id', clientId)
    expect(await count(kh, 'workout_plans', 'id', planId)).toBe(0)
    expect(await count(kh, 'workout_sessions', 'plan_id', planId)).toBe(0)
    expect(await count(kh, 'meal_plans', 'phase_id', phaseId)).toBe(0)
    expect(await count(kh, 'notes', 'client_id', clientId)).toBe(0)
    expect(await count(kh, 'measurements', 'client_id', clientId)).toBeGreaterThanOrEqual(1)
    expect(await count(kh, 'progress_photos', 'client_id', clientId)).toBe(1)
    expect((await selfMeasure()).error).toBeNull()
  })

  it('HLV không bị ảnh hưởng; chỉ FM đổi gói / sửa cấu hình gói', async () => {
    expect(await count(pt, 'workout_plans', 'id', planId)).toBe(1)
    expect((await pt.from('clients').update({ tier_id: basicId }).eq('id', clientId)).error).not.toBeNull()
    expect((await pt.from('clients').update({ phone: '0900' }).eq('id', clientId).select()).data).toHaveLength(1)
    expect((await pt.from('service_tiers').update({ features: [] }).eq('id', basicId).select()).data ?? []).toEqual([])
    expect((await kh.from('service_tiers').update({ features: [] }).eq('id', basicId).select()).data ?? []).toEqual([])
  })
})
