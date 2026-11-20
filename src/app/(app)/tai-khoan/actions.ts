'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'
import { normalizeEmail } from '@/lib/origin'
import { sendEmailChangeCode, sendEmailChangedNotice } from '@/lib/email'

const CODE_TTL_MIN = 15
const MAX_ATTEMPTS = 5
const hash = (userId: string, code: string) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex')

/** Mọi vai trò tự sửa họ tên và số điện thoại của chính mình */
export async function updateMyProfile(input: { full_name: string; phone: string }) {
  return run(async () => {
    const me = await requireApiRole()
    const name = input.full_name.trim()
    if (name.length < 2) throw new HttpError(400, 'Vui lòng nhập họ tên.')
    if (name.length > 100) throw new HttpError(400, 'Họ tên quá dài.')
    const phone = input.phone.replace(/[^\d+ ]/g, '').trim()
    // RLS profiles_update_self + trigger chặn đổi vai trò / email / trạng thái
    must(await (await createClient()).from('profiles').update({ full_name: name, phone: phone || null }).eq('id', me.id))
    revalidatePath('/', 'layout')
  })
}

/** Bước 1 — FM nhập email mới, gửi mã 6 số tới email mới */
export async function requestEmailChange(newEmailRaw: string) {
  return run(async () => {
    const me = await requireApiRole('fm')
    const newEmail = normalizeEmail(newEmailRaw)
    if (!newEmail) throw new HttpError(400, 'Email không hợp lệ.')
    if (newEmail === me.email) throw new HttpError(400, 'Đây đang là email hiện tại.')
    const admin = createAdminClient()

    const { data: taken } = await admin.from('profiles').select('id').eq('email', newEmail).maybeSingle()
    if (taken) throw new HttpError(409, 'Email này đã được dùng cho một tài khoản khác.')

    const { data: prev } = await admin.from('email_change_requests').select('created_at').eq('user_id', me.id).maybeSingle()
    if (prev) {
      const wait = Math.ceil((new Date(prev.created_at).getTime() + 60_000 - Date.now()) / 1000)
      if (wait > 0) throw new HttpError(429, `Vui lòng chờ ${wait} giây rồi gửi lại.`)
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    must(await admin.from('email_change_requests').upsert({
      user_id: me.id, new_email: newEmail, code_hash: hash(me.id, code), attempts: 0,
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(), created_at: new Date().toISOString(),
    }))
    try {
      await sendEmailChangeCode(newEmail, code)
    } catch {
      await admin.from('email_change_requests').delete().eq('user_id', me.id)
      throw new HttpError(502, 'Không gửi được email xác nhận, vui lòng thử lại.')
    }
    return { email: newEmail }
  })
}

/** Bước 2 — nhập mã đúng → đổi email đăng nhập, báo cho email cũ */
export async function confirmEmailChange(codeRaw: string) {
  return run(async () => {
    const me = await requireApiRole('fm')
    const code = codeRaw.replace(/\D/g, '')
    const admin = createAdminClient()
    const { data: req } = await admin.from('email_change_requests').select('*').eq('user_id', me.id).maybeSingle()
    if (!req) throw new HttpError(400, 'Không có yêu cầu đổi email nào. Vui lòng nhập email mới và gửi mã lại.')
    if (new Date(req.expires_at).getTime() < Date.now()) {
      await admin.from('email_change_requests').delete().eq('user_id', me.id)
      throw new HttpError(400, 'Mã đã hết hạn. Vui lòng gửi mã mới.')
    }
    if (req.attempts >= MAX_ATTEMPTS) {
      await admin.from('email_change_requests').delete().eq('user_id', me.id)
      throw new HttpError(429, 'Nhập sai quá nhiều lần. Vui lòng gửi mã mới.')
    }
    const a = Buffer.from(hash(me.id, code)), b = Buffer.from(req.code_hash)
    if (code.length !== 6 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await admin.from('email_change_requests').update({ attempts: req.attempts + 1 }).eq('user_id', me.id)
      throw new HttpError(400, `Mã không đúng. Còn ${MAX_ATTEMPTS - req.attempts - 1} lần thử.`)
    }

    // Kiểm tra lại lần nữa: email mới vẫn chưa ai dùng
    const { data: taken } = await admin.from('profiles').select('id').eq('email', req.new_email).maybeSingle()
    if (taken) throw new HttpError(409, 'Email này vừa được dùng cho tài khoản khác.')

    const { error } = await admin.auth.admin.updateUserById(me.id, { email: req.new_email, email_confirm: true })
    if (error) throw new HttpError(500, 'Không đổi được email, vui lòng thử lại.')
    const { error: pErr } = await admin.from('profiles').update({ email: req.new_email }).eq('id', me.id)
    if (pErr) {
      await admin.auth.admin.updateUserById(me.id, { email: me.email, email_confirm: true }) // hoàn tác
      throw new HttpError(500, 'Không đổi được email, vui lòng thử lại.')
    }
    await admin.from('email_change_requests').delete().eq('user_id', me.id)
    try { await sendEmailChangedNotice(me.email, me.full_name, req.new_email, new Date()) } catch { /* đã đổi xong; thông báo là phụ */ }
    revalidatePath('/', 'layout')
    return { email: req.new_email }
  })
}

export async function cancelEmailChange() {
  return run(async () => {
    const me = await requireApiRole('fm')
    await createAdminClient().from('email_change_requests').delete().eq('user_id', me.id)
  })
}
