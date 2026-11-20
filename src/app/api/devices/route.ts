import { apiError, requireApiRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { currentDeviceKey, revokeDevices } from '@/lib/devices'

// Đăng xuất từ xa.
//   { id: "<device id>" }  → đăng xuất một máy
//   { others: true }        → đăng xuất tất cả máy khác (giữ máy đang dùng)
export async function POST(req: Request) {
  try {
    const me = await requireApiRole()
    const body = await req.json().catch(() => ({}))
    const key = await currentDeviceKey()
    const admin = createAdminClient()

    const { data: devices } = await admin.from('devices')
      .select('id, device_key').eq('user_id', me.id).is('revoked_at', null)
    const list = devices ?? []

    let ids: string[] = []
    if (body.others === true) {
      ids = list.filter((d) => d.device_key !== key).map((d) => d.id)
    } else if (typeof body.id === 'string') {
      const target = list.find((d) => d.id === body.id)
      if (!target) return Response.json({ error: 'Không tìm thấy thiết bị.' }, { status: 404 })
      if (target.device_key === key) {
        return Response.json({ error: 'Đây là máy đang dùng — hãy dùng nút Đăng xuất.' }, { status: 400 })
      }
      ids = [target.id]
    } else {
      return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 })
    }

    await revokeDevices(me.id, ids)
    return Response.json({ ok: true, revoked: ids.length })
  } catch (e) {
    return apiError(e)
  }
}
