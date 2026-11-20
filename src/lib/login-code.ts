import 'server-only'
import crypto from 'node:crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Mã đăng nhập 6 số do app tự sinh (không dùng email_otp của Supabase vì độ dài phụ thuộc
// cài đặt project — hiện là 8 số). Sau khi mã / link hợp lệ, app xin Supabase một magic-link
// token rồi đổi ngay thành phiên đăng nhập trên chính trình duyệt này.
export const CODE_TTL_MIN = 15
const MAX_ATTEMPTS = 5
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

/** Sinh mã 6 số + token cho nút "Đăng nhập" trong email; lưu bản băm (ghi đè mã cũ). */
export async function issueLoginCode(email: string) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const linkToken = crypto.randomBytes(24).toString('base64url')
  const { error } = await createAdminClient().from('login_codes').upsert({
    email, code_hash: sha(`${email}:${code}`), link_hash: sha(linkToken), attempts: 0,
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(), created_at: new Date().toISOString(),
  })
  if (error) throw error
  return { code, linkToken }
}

type Check = { ok: true; email: string } | { ok: false; error: string }

/** Kiểm tra mã 6 số người dùng nhập. Đúng → xoá mã (dùng một lần). */
export async function checkLoginCode(email: string, code: string): Promise<Check> {
  const admin = createAdminClient()
  const { data: row } = await admin.from('login_codes').select('*').eq('email', email).maybeSingle()
  const fail = 'Mã không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại hoặc gửi mã mới.'
  if (!row) return { ok: false, error: fail }
  if (new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_ATTEMPTS) {
    await admin.from('login_codes').delete().eq('email', email)
    return { ok: false, error: row.attempts >= MAX_ATTEMPTS ? 'Nhập sai quá nhiều lần. Vui lòng gửi mã mới.' : fail }
  }
  const a = Buffer.from(sha(`${email}:${code}`)), b = Buffer.from(row.code_hash)
  if (code.length !== 6 || !crypto.timingSafeEqual(a, b)) {
    await admin.from('login_codes').update({ attempts: row.attempts + 1 }).eq('email', email)
    const left = MAX_ATTEMPTS - row.attempts - 1
    return { ok: false, error: left > 0 ? `Mã không đúng. Còn ${left} lần thử.` : 'Nhập sai quá nhiều lần. Vui lòng gửi mã mới.' }
  }
  await admin.from('login_codes').delete().eq('email', email)
  return { ok: true, email }
}

/** Kiểm tra token của nút "Đăng nhập" trong email. Đúng → xoá (dùng một lần). */
export async function checkLoginLink(token: string): Promise<Check> {
  const admin = createAdminClient()
  const { data: row } = await admin.from('login_codes').select('email, expires_at').eq('link_hash', sha(token)).maybeSingle()
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: 'expired' }
  await admin.from('login_codes').delete().eq('email', row.email)
  return { ok: true, email: row.email }
}

/** Tạo phiên Supabase (cookie) cho email đã được xác minh ở trên. */
export async function startSession(email: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) return null
  const supabase = await createClient()
  const { data: s, error: e2 } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (e2 || !s.session || !s.user) return null
  return s
}
