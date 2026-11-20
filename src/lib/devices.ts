import 'server-only'
import crypto from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { deviceLabel } from '@/lib/device-label'
import { sendNewDeviceEmail } from '@/lib/email'

// Mỗi trình duyệt có một mã thiết bị ngẫu nhiên trong cookie httpOnly.
// Một thiết bị chỉ "hợp lệ" sau khi đăng nhập bằng mã/link email trên chính nó.
export const DEVICE_COOKIE = 'urg_device'
const ONE_YEAR = 60 * 60 * 24 * 400

export async function getOrCreateDeviceKey(): Promise<string> {
  const store = await cookies()
  let key = store.get(DEVICE_COOKIE)?.value
  if (!key || key.length < 32) {
    key = crypto.randomBytes(24).toString('base64url')
  }
  // Chỉ đặt cờ Secure khi trang thật sự chạy HTTPS (Vercel). Mở qua http://<IP-máy>:3000
  // trên điện thoại cùng Wi-Fi mà vẫn đặt Secure thì trình duyệt bỏ cookie → không nhớ thiết bị.
  store.set(DEVICE_COOKIE, key, {
    httpOnly: true, secure: await isHttps(),
    sameSite: 'lax', path: '/', maxAge: ONE_YEAR,
  })
  return key
}

async function isHttps(): Promise<boolean> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? (process.env.APP_URL?.startsWith('https') ? 'https' : 'http')
  return proto.split(',')[0].trim() === 'https'
}

export async function currentDeviceKey(): Promise<string | null> {
  return (await cookies()).get(DEVICE_COOKIE)?.value ?? null
}

/** session_id nằm trong access token (JWT) do Supabase cấp. */
export function sessionIdFromToken(accessToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString())
    return typeof payload.session_id === 'string' ? payload.session_id : null
  } catch { return null }
}

/**
 * Ghi nhận thiết bị vừa xác nhận qua email. Thiết bị chưa từng thấy (và tài khoản
 * đã có thiết bị khác trước đó) → gửi email cảnh báo cho chủ tài khoản.
 */
export async function registerDevice(opts: {
  userId: string; accessToken: string; userAgent: string | null; origin: string
}) {
  const admin = createAdminClient()
  const key = await getOrCreateDeviceKey()
  const label = deviceLabel(opts.userAgent)
  const sessionId = sessionIdFromToken(opts.accessToken)
  const now = new Date()

  const { data: existing } = await admin.from('devices')
    .select('id').eq('user_id', opts.userId).eq('device_key', key).maybeSingle()

  if (existing) {
    // Phiên cũ của máy này (nếu còn) không cần nữa — giữ một phiên/thiết bị
    await admin.from('devices').update({
      session_id: sessionId, label, user_agent: opts.userAgent,
      last_seen: now.toISOString(), revoked_at: null,
    }).eq('id', existing.id)
    return { isNew: false }
  }

  const { count } = await admin.from('devices')
    .select('id', { count: 'exact', head: true }).eq('user_id', opts.userId)

  await admin.from('devices').insert({
    user_id: opts.userId, device_key: key, label, user_agent: opts.userAgent,
    session_id: sessionId, first_seen: now.toISOString(), last_seen: now.toISOString(),
  })

  if ((count ?? 0) > 0) {
    const { data: profile } = await admin.from('profiles')
      .select('email, full_name').eq('id', opts.userId).single()
    if (profile) {
      try {
        await sendNewDeviceEmail(profile.email, profile.full_name, label, now, `${opts.origin}/thiet-bi`)
      } catch {
        console.error('[devices] gửi email cảnh báo thất bại')
      }
    }
  }
  return { isNew: true }
}

/** Đăng xuất các thiết bị (đánh dấu thu hồi + xoá phiên Supabase của chúng). */
export async function revokeDevices(userId: string, deviceIds: string[]) {
  if (!deviceIds.length) return
  const admin = createAdminClient()
  const { data } = await admin.from('devices')
    .select('id, session_id').eq('user_id', userId).in('id', deviceIds)
  for (const d of data ?? []) {
    if (d.session_id) await admin.rpc('revoke_auth_session', { sid: d.session_id })
  }
  await admin.from('devices').update({ revoked_at: new Date().toISOString(), session_id: null })
    .eq('user_id', userId).in('id', (data ?? []).map((d) => d.id))
}
