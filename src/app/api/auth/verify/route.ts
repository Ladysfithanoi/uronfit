import { createClient, createAdminClient } from '@/lib/supabase/server'
import { registerDevice } from '@/lib/devices'
import { homePath } from '@/lib/labels'
import { appOrigin, normalizeEmail } from '@/lib/origin'
import type { UserRole } from '@/lib/types'

// Xác nhận mã 6 số trong email → tạo phiên trên CHÍNH thiết bị này.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : ''
  if (!email || code.length < 6) return Response.json({ error: 'Vui lòng nhập đủ mã trong email.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error || !data.session || !data.user) {
    return Response.json({ error: 'Mã không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại hoặc gửi mã mới.' }, { status: 400 })
  }

  await registerDevice({
    userId: data.user.id, accessToken: data.session.access_token,
    userAgent: req.headers.get('user-agent'), origin: appOrigin(req),
  })

  const { data: profile } = await createAdminClient().from('profiles')
    .select('role').eq('id', data.user.id).single()
  return Response.json({ ok: true, redirect: homePath((profile?.role ?? 'client') as UserRole) })
}
