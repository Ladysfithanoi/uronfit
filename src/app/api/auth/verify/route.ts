import { createAdminClient } from '@/lib/supabase/server'
import { registerDevice } from '@/lib/devices'
import { checkLoginCode, startSession } from '@/lib/login-code'
import { homePath } from '@/lib/labels'
import { appOrigin, normalizeEmail } from '@/lib/origin'
import type { UserRole } from '@/lib/types'

// Xác nhận mã 6 số trong email → tạo phiên trên CHÍNH thiết bị này.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : ''
  if (!email || code.length !== 6) return Response.json({ error: 'Vui lòng nhập đủ 6 số trong email.' }, { status: 400 })

  const check = await checkLoginCode(email, code)
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 })

  const s = await startSession(email)
  if (!s) return Response.json({ error: 'Không đăng nhập được lúc này, vui lòng gửi mã mới.' }, { status: 500 })

  await registerDevice({
    userId: s.user!.id, accessToken: s.session!.access_token,
    userAgent: req.headers.get('user-agent'), origin: appOrigin(req),
  })

  const { data: profile } = await createAdminClient().from('profiles').select('role').eq('id', s.user!.id).single()
  return Response.json({ ok: true, redirect: homePath((profile?.role ?? 'client') as UserRole) })
}
