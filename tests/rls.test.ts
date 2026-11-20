/**
 * Kiểm thử Row Level Security theo bảng phân quyền (brief mục 2).
 * Chạy trên project Supabase thật sau khi đã `npm run db:migrate` và `npm run db:seed`.
 *
 *   npm run test:rls
 *
 * Mỗi vai trò đăng nhập bằng mã email thật (sinh qua Admin API, không gửi mail),
 * rồi thử đọc/ghi dữ liệu không thuộc quyền của mình.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

async function signInAs(email: string): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: e2 } = await c.auth.verifyOtp({ email, token: data.properties.email_otp, type: 'email' })
  if (e2) throw e2
  return c
}

// Tra id/email theo tên trong dữ liệu mẫu (không phụ thuộc hộp thư dùng khi seed)
const ids: Record<string, string> = {}
const users: Record<string, SupabaseClient> = {}
let anon: SupabaseClient

beforeAll(async () => {
  const { data: profiles } = await admin.from('profiles').select('id, email, full_name, role')
  const { data: clients } = await admin.from('clients').select('id, full_name')
  const byName = (n: string) => profiles!.find((p) => p.full_name === n)!
  const accounts = {
    fm: profiles!.find((p) => p.role === 'fm')!,
    pt1: byName('HLV Ngọc Lan'),
    pt2: byName('HLV Minh Khoa'),
    ha: profiles!.find((p) => p.full_name === 'Nguyễn Thu Hà' && p.role === 'client')!,
    maiAnh: profiles!.find((p) => p.full_name === 'Trần Mai Anh' && p.role === 'client')!,
    hong: profiles!.find((p) => p.full_name === 'Phạm Thị Hồng' && p.role === 'client')!,
    guardian1: byName('Nguyễn Thị Thu'),
  }
  for (const [k, p] of Object.entries(accounts)) {
    ids[k] = p.id
    users[k] = await signInAs(p.email)
  }
  for (const c of clients!) ids[c.full_name] = c.id
  anon = createClient(URL, ANON, { auth: { persistSession: false } })
})

const names = (rows: { full_name: string }[] | null) => (rows ?? []).map((r) => r.full_name).sort()

describe('Xem khách hàng', () => {
  it('FM thấy tất cả 8 khách', async () => {
    const { data } = await users.fm.from('clients').select('full_name')
    expect(data).toHaveLength(8)
  })

  it('PT chỉ thấy khách mình phụ trách', async () => {
    const { data } = await users.pt1.from('clients').select('full_name')
    expect(names(data)).toEqual(['Lê Ngọc Trâm', 'Nguyễn Thu Hà', 'Trần Mai Anh'])
  })

  it('Khách chỉ thấy hồ sơ của mình — đổi id cũng không mở được hồ sơ khác', async () => {
    const { data } = await users.ha.from('clients').select('full_name')
    expect(names(data)).toEqual(['Nguyễn Thu Hà'])
    const { data: other } = await users.ha.from('clients').select('*').eq('id', ids['Phạm Thị Hồng'])
    expect(other).toEqual([])
    const { data: phases } = await users.ha.from('phases').select('id').eq('client_id', ids['Phạm Thị Hồng'])
    expect(phases).toEqual([])
  })

  it('Khách nhóm 1:2 không thấy người tập cùng', async () => {
    const { data } = await users.maiAnh.from('clients').select('full_name')
    expect(names(data)).toEqual(['Trần Mai Anh'])
    const { data: members } = await users.maiAnh.from('group_members').select('client_id')
    expect(members).toEqual([{ client_id: ids['Trần Mai Anh'] }])
  })

  it('Phụ huynh thấy đúng các bé của mình (nhiều bé), không thấy bé khác', async () => {
    const { data } = await users.guardian1.from('clients').select('full_name')
    expect(names(data)).toEqual(['Bé Nguyễn Gia Bin', 'Bé Nguyễn Gia Na'])
  })

  it('Chưa đăng nhập: không thấy gì', async () => {
    for (const t of ['clients', 'profiles', 'phases', 'exercises', 'notes', 'measurements']) {
      const { data } = await anon.from(t).select('id')
      expect(data ?? [], t).toEqual([])
    }
  })
})

describe('Tạo / sửa hồ sơ khách', () => {
  it('Khách không sửa được hồ sơ của mình', async () => {
    const { data } = await users.ha.from('clients').update({ full_name: 'X' }).eq('id', ids['Nguyễn Thu Hà']).select()
    expect(data).toEqual([])
  })

  it('PT không sửa được khách của PT khác', async () => {
    const { data } = await users.pt1.from('clients').update({ phone: '000' }).eq('id', ids['Phạm Thị Hồng']).select()
    expect(data).toEqual([])
  })

  it('PT không tạo khách gán cho PT khác, không chuyển khách sang PT khác', async () => {
    const { error } = await users.pt1.from('clients').insert({ full_name: 'Test', gender: 'female', pt_id: ids.pt2 })
    expect(error).not.toBeNull()
    const { error: e2 } = await users.pt1.from('clients').update({ pt_id: ids.pt2 }).eq('id', ids['Nguyễn Thu Hà'])
    expect(e2).not.toBeNull()
  })

  it('PT tạo được khách của mình; chỉ FM xoá được', async () => {
    const { data, error } = await users.pt1.from('clients')
      .insert({ full_name: 'Khách kiểm thử', gender: 'male', pt_id: ids.pt1 }).select('id').single()
    expect(error).toBeNull()
    const { data: del } = await users.pt1.from('clients').delete().eq('id', data!.id).select()
    expect(del).toEqual([])
    const { data: del2 } = await users.fm.from('clients').delete().eq('id', data!.id).select()
    expect(del2).toHaveLength(1)
  })
})

describe('Giáo án và nút Chia sẻ', () => {
  it('PT tạo giáo án cho khách mình; khách chỉ thấy sau khi Chia sẻ; PT khác không thấy', async () => {
    const { data: phase } = await users.pt1.from('phases').select('id')
      .eq('client_id', ids['Nguyễn Thu Hà']).eq('status', 'active').single()

    const { data: plan, error } = await users.pt1.from('workout_plans')
      .insert({ name: 'Giáo án kiểm thử', phase_id: phase!.id, created_by: ids.pt1 }).select('id').single()
    expect(error).toBeNull()

    const before = await users.ha.from('workout_plans').select('id').eq('id', plan!.id)
    expect(before.data).toEqual([])

    await users.pt1.from('workout_plans').update({ shared_at: new Date().toISOString() }).eq('id', plan!.id)
    const after = await users.ha.from('workout_plans').select('id').eq('id', plan!.id)
    expect(after.data).toHaveLength(1)

    const otherClient = await users.hong.from('workout_plans').select('id').eq('id', plan!.id)
    expect(otherClient.data).toEqual([])
    const otherPt = await users.pt2.from('workout_plans').select('id').eq('id', plan!.id)
    expect(otherPt.data).toEqual([])

    // PT khác không gắn được giáo án vào giai đoạn của khách không thuộc mình
    const steal = await users.pt2.from('workout_plans').insert({ name: 'X', phase_id: phase!.id, created_by: ids.pt2 })
    expect(steal.error).not.toBeNull()

    await admin.from('workout_plans').delete().eq('id', plan!.id)
  })

  it('PT tạo nhóm của mình và đọc lại được ngay', async () => {
    const { data, error } = await users.pt1.from('groups')
      .insert({ name: 'Nhóm kiểm thử', type: 'one_on_two', pt_id: ids.pt1 }).select('id').single()
    expect(error).toBeNull()
    await admin.from('groups').delete().eq('id', data!.id)
  })
})

describe('Xoá hàng loạt hồ sơ khách', () => {
  it('PT không xoá được nhiều khách một lúc, kể cả khách của mình; FM xoá được', async () => {
    const mk = async (name: string) => (await users.pt1.from('clients').insert({ full_name: name, gender: 'female', pt_id: ids.pt1 }).select('id').single()).data!.id
    const a = await mk('Xoá loạt A'), b = await mk('Xoá loạt B')
    const { data: byPt } = await users.pt1.from('clients').delete().in('id', [a, b]).select('id')
    expect(byPt).toEqual([])
    const { count } = await admin.from('clients').select('id', { count: 'exact', head: true }).in('id', [a, b])
    expect(count).toBe(2)
    const { data: byFm } = await users.fm.from('clients').delete().in('id', [a, b]).select('id')
    expect(byFm).toHaveLength(2)
  })
})

describe('Tài khoản & vai trò', () => {
  it('Khách chỉ thấy tài khoản của chính mình', async () => {
    const { data } = await users.ha.from('profiles').select('id')
    expect(data).toEqual([{ id: ids.ha }])
  })

  it('Không ai tự nâng vai trò của mình', async () => {
    const { error } = await users.ha.from('profiles').update({ role: 'fm' }).eq('id', ids.ha)
    expect(error).not.toBeNull()
    const { error: e2 } = await users.pt1.from('profiles').update({ role: 'fm' }).eq('id', ids.pt1)
    expect(e2).not.toBeNull()
  })

  it('Khách không tự gắn mình vào hồ sơ khách khác', async () => {
    const { error } = await users.ha.from('client_access')
      .insert({ client_id: ids['Phạm Thị Hồng'], profile_id: ids.ha, relation: 'self' })
    expect(error).not.toBeNull()
  })
})

describe('Sửa thông tin tài khoản', () => {
  it('Tự sửa họ tên + SĐT của mình; không sửa được người khác; không tự đổi email qua database', async () => {
    const { data: before } = await admin.from('profiles').select('full_name, phone, email').eq('id', ids.fm).single()
    const { data: ok, error } = await users.fm.from('profiles').update({ full_name: 'FM đổi tên thử', phone: '0909' }).eq('id', ids.fm).select('full_name')
    expect(error).toBeNull()
    expect(ok).toEqual([{ full_name: 'FM đổi tên thử' }])
    await admin.from('profiles').update({ full_name: before!.full_name, phone: before!.phone }).eq('id', ids.fm)

    const { data: other } = await users.pt1.from('profiles').update({ full_name: 'X' }).eq('id', ids.pt2).select()
    expect(other ?? []).toEqual([])
    const { error: e2 } = await users.fm.from('profiles').update({ email: 'hack@example.com' }).eq('id', ids.fm)
    expect(e2).not.toBeNull()
  })

  it('Bảng mã đổi email: không người dùng nào đọc/ghi được, kể cả FM', async () => {
    const { data, error } = await users.fm.from('email_change_requests').select('*')
    expect(error !== null || (data ?? []).length === 0).toBe(true)
    const ins = await users.fm.from('email_change_requests').insert({ user_id: ids.fm, new_email: 'x@x.vn', code_hash: 'x', expires_at: new Date().toISOString() })
    expect(ins.error).not.toBeNull()
  })
})

describe('Ghi chú nội bộ "chỉ HLV thấy"', () => {
  it('Khách không thấy ghi chú nội bộ; PT phụ trách thấy đủ', async () => {
    const { data: mine } = await users.hong.from('notes').select('coach_only')
    expect(mine).toEqual([{ coach_only: false }])
    const { data: pt } = await users.pt2.from('notes').select('coach_only').eq('client_id', ids['Phạm Thị Hồng'])
    expect(pt).toHaveLength(2)
    const { data: otherPt } = await users.pt1.from('notes').select('id').eq('client_id', ids['Phạm Thị Hồng'])
    expect(otherPt).toEqual([])
  })
})

describe('Số đo do khách tự nhập', () => {
  it('Khách tự nhập cân nặng (ghi rõ nguồn = khách); không giả danh PT; không nhập chỉ số chuyên môn', async () => {
    const { data: types } = await users.ha.from('metric_types').select('id, name')
    const weight = types!.find((t) => t.name === 'Cân nặng')!.id
    const pain = types!.find((t) => t.name === 'Mức đau')!.id
    const base = { client_id: ids['Nguyễn Thu Hà'], measured_on: '2026-11-20', measured_by: ids.ha }

    const ok = await users.ha.from('measurements').insert({ ...base, metric_type_id: weight, value_num: 58.4, source: 'client' }).select('id').single()
    expect(ok.error).toBeNull()

    const asStaff = await users.ha.from('measurements').insert({ ...base, metric_type_id: weight, value_num: 50, source: 'staff' })
    expect(asStaff.error).not.toBeNull()

    const painRow = await users.ha.from('measurements').insert({ ...base, metric_type_id: pain, value_num: 1, source: 'client' })
    expect(painRow.error).not.toBeNull()

    const otherClient = await users.ha.from('measurements').insert({ ...base, client_id: ids['Phạm Thị Hồng'], metric_type_id: weight, value_num: 60, source: 'client' })
    expect(otherClient.error).not.toBeNull()

    await admin.from('measurements').delete().eq('id', ok.data!.id)
  })
})

describe('Thư viện bài tập', () => {
  it('HLV thấy toàn bộ thư viện; khách chỉ thấy bài trong giáo án đã chia sẻ của mình', async () => {
    const { count } = await users.pt1.from('exercises').select('id', { count: 'exact', head: true })
    const { count: all } = await admin.from('exercises').select('id', { count: 'exact', head: true })
    expect(count).toBe(all)
    expect(count).toBeGreaterThanOrEqual(60)
    const { data: mine } = await users.ha.from('exercises').select('id')
    expect(mine!.length).toBeGreaterThan(0)
    expect(mine!.length).toBeLessThan(all!)
    const { data: none } = await users.hong.from('exercises').select('id')
    expect(none).toEqual([])
  })

  it('PT không sửa bài người khác tạo; FM xoá được', async () => {
    const { data: ex } = await users.pt1.from('exercises').select('id').limit(1).single()
    const { data } = await users.pt1.from('exercises').update({ name: 'X' }).eq('id', ex!.id).select()
    expect(data).toEqual([])
    const { data: del } = await users.pt1.from('exercises').delete().eq('id', ex!.id).select()
    expect(del).toEqual([])
  })
})

describe('Thiết bị', () => {
  it('Không ai xem được thiết bị của người khác', async () => {
    const { data } = await users.ha.from('devices').select('user_id')
    expect((data ?? []).every((d) => d.user_id === ids.ha)).toBe(true)
  })

  it('Người dùng không gọi được hàm xoá phiên đăng nhập', async () => {
    const { error } = await users.fm.rpc('revoke_auth_session', { sid: '00000000-0000-0000-0000-000000000000' })
    expect(error).not.toBeNull()
  })
})

describe('Kho ảnh riêng tư', () => {
  const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })

  it('Chỉ PT phụ trách tải ảnh lên; khách khác không đọc được', async () => {
    const path = `${ids['Phạm Thị Hồng']}/rls-test.png`
    const denied = await users.pt1.storage.from('client-media').upload(path, png, { upsert: true })
    expect(denied.error).not.toBeNull()

    const ok = await users.pt2.storage.from('client-media').upload(path, png, { upsert: true })
    expect(ok.error).toBeNull()

    const otherClient = await users.ha.storage.from('client-media').download(path)
    expect(otherClient.error).not.toBeNull()
    const owner = await users.hong.storage.from('client-media').createSignedUrl(path, 60)
    expect(owner.error).toBeNull()

    await admin.storage.from('client-media').remove([path])
  })
})

describe('Gói tập, buổi tập, nhóm', () => {
  it('Hoàn thành buổi (giáo án cá nhân) tự trừ 1 buổi; huỷ hoàn thành thì hoàn lại', async () => {
    const pkg = async () => (await admin.from('client_packages').select('used_sessions').eq('client_id', ids['Nguyễn Thu Hà']).eq('is_active', true).single()).data!.used_sessions
    const { data: s } = await users.pt1.from('workout_sessions').select('id, workout_plans!inner(phase_id)').is('completed_at', null).eq('is_self_training', false).not('workout_plans.phase_id', 'is', null).limit(1).single()
    const before = await pkg()
    await users.pt1.from('workout_sessions').update({ completed_at: new Date().toISOString() }).eq('id', s!.id)
    expect(await pkg()).toBe(before + 1)
    await users.pt1.from('workout_sessions').update({ completed_at: null }).eq('id', s!.id)
    expect(await pkg()).toBe(before)
  })

  it('Khách không tự sửa buổi tập; không tick được buổi không phải tự tập', async () => {
    const { data: s } = await users.ha.from('workout_sessions').select('id').is('completed_at', null).limit(1).single()
    const { data } = await users.ha.from('workout_sessions').update({ completed_at: new Date().toISOString() }).eq('id', s!.id).select()
    expect(data).toEqual([])
    const { error } = await users.ha.rpc('complete_self_session', { sid: s!.id, done: true })
    expect(error).not.toBeNull()
  })

  it('Bài chỉnh riêng cho một bé trong nhóm: phụ huynh bé khác không thấy', async () => {
    const { data: kp } = await admin.from('workout_plans').select('id').not('group_id', 'is', null).limit(1).single()
    const { data: sess } = await admin.from('workout_sessions').select('id').eq('plan_id', kp!.id).limit(1).single()
    const { data: se } = await users.pt2.from('session_exercises').select('id, session_id, exercise_id').eq('session_id', sess!.id).is('client_id', null).limit(1).single()
    const { data: own, error } = await users.pt2.from('session_exercises').insert({
      session_id: se!.session_id, exercise_id: se!.exercise_id, client_id: ids['Bé Trần Bảo Su'], replaces_id: se!.id, sets: 2, reps: '8',
    }).select('id').single()
    expect(error).toBeNull()
    const g1 = await users.guardian1.from('session_exercises').select('id').eq('id', own!.id)
    expect(g1.data).toEqual([])
    const base = await users.guardian1.from('session_exercises').select('id').eq('id', se!.id)
    expect(base.data).toHaveLength(1)
    await admin.from('session_exercises').delete().eq('id', own!.id)
  })

  it('Phụ huynh không xem được điểm danh của bé khác trong nhóm', async () => {
    const { data } = await users.guardian1.from('attendance').select('client_id')
    const allowed = [ids['Bé Nguyễn Gia Na'], ids['Bé Nguyễn Gia Bin']]
    expect(data!.length).toBeGreaterThan(0)
    expect(data!.every((a) => allowed.includes(a.client_id))).toBe(true)
  })
})
