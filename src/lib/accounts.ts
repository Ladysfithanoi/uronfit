import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email'
import { HttpError } from '@/lib/auth'
import { normalizeEmail } from '@/lib/origin'
import type { Profile, UserRole } from '@/lib/types'

export async function originFromHeaders(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * Tạo tài khoản đăng nhập (chỉ gọi SAU khi đã kiểm tra quyền người tạo).
 * Email đã có tài khoản cùng vai trò → dùng lại (vd một phụ huynh gắn thêm bé thứ hai).
 */
export async function createAccount(opts: {
  email: string; fullName: string; role: UserRole; phone?: string | null; createdBy: Profile
}): Promise<{ id: string; reused: boolean }> {
  const email = normalizeEmail(opts.email)
  if (!email) throw new HttpError(400, 'Email không hợp lệ.')
  const admin = createAdminClient()

  const { data: existing } = await admin.from('profiles').select('id, role, is_active').eq('email', email).maybeSingle()
  if (existing) {
    if (existing.role !== opts.role) {
      throw new HttpError(409, 'Email này đã được dùng cho một tài khoản khác vai trò. Vui lòng dùng email khác.')
    }
    if (!existing.is_active) await admin.from('profiles').update({ is_active: true }).eq('id', existing.id)
    return { id: existing.id, reused: true }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { full_name: opts.fullName },
  })
  if (error || !data.user) {
    if (/already/i.test(error?.message ?? '')) throw new HttpError(409, 'Email này đã có tài khoản đăng nhập.')
    throw new HttpError(500, 'Không tạo được tài khoản, vui lòng thử lại.')
  }
  const { error: pErr } = await admin.from('profiles').insert({
    id: data.user.id, full_name: opts.fullName.trim(), role: opts.role, email,
    phone: opts.phone?.trim() || null, created_by: opts.createdBy.id,
  })
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw new HttpError(500, 'Không tạo được hồ sơ tài khoản, vui lòng thử lại.')
  }

  try {
    await sendInviteEmail(email, opts.fullName.trim(), opts.createdBy.full_name, `${await originFromHeaders()}/login`)
  } catch {
    console.error('[accounts] gửi email mời thất bại')
  }
  return { id: data.user.id, reused: false }
}

/** Khoá / mở khoá tài khoản. Khoá = đăng xuất mọi thiết bị ngay lập tức. */
export async function setAccountActive(userId: string, active: boolean) {
  const admin = createAdminClient()
  await admin.from('profiles').update({ is_active: active }).eq('id', userId)
  if (!active) {
    const { data } = await admin.from('devices').select('id, session_id').eq('user_id', userId).is('revoked_at', null)
    for (const d of data ?? []) if (d.session_id) await admin.rpc('revoke_auth_session', { sid: d.session_id })
    await admin.from('devices').update({ revoked_at: new Date().toISOString(), session_id: null }).eq('user_id', userId)
  }
}
