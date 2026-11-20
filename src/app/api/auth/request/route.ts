import { createAdminClient } from '@/lib/supabase/server'
import { sendLoginEmail } from '@/lib/email'
import { appOrigin, normalizeEmail } from '@/lib/origin'

// Gửi email đăng nhập (mã 6 số + link). Chỉ tài khoản đã được FM/PT tạo mới nhận được.
// Luôn trả cùng một thông báo để không lộ email nào là khách của phòng tập.
const GENERIC = {
  ok: true,
  message: 'Nếu email này đã được phòng tập tạo tài khoản, mã sẽ tới trong vài giây. Không nhận được? Kiểm tra lại đúng email đã đăng ký hoặc hỏi HLV của bạn.',
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  if (!email) return Response.json({ error: 'Email không hợp lệ.' }, { status: 400 })

  const admin = createAdminClient()

  // Giới hạn: 1 email/60 giây và 5 email/15 phút cho mỗi địa chỉ
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: recent } = await admin.from('login_requests')
    .select('created_at').eq('email', email).gte('created_at', since)
    .order('created_at', { ascending: false })
  if (recent?.length) {
    const last = new Date(recent[0].created_at).getTime()
    const wait = Math.ceil((last + 60_000 - Date.now()) / 1000)
    if (wait > 0) return Response.json({ error: `Vui lòng chờ ${wait} giây rồi gửi lại.`, retryAfter: wait }, { status: 429 })
    if (recent.length >= 5) return Response.json({ error: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau 15 phút.' }, { status: 429 })
  }
  await admin.from('login_requests').insert({ email })

  const { data: profile } = await admin.from('profiles')
    .select('id, is_active').eq('email', email).maybeSingle()
  if (!profile?.is_active) return Response.json(GENERIC)

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties) {
    console.error('[auth/request] không tạo được mã đăng nhập')
    return Response.json({ error: 'Không gửi được mã lúc này, vui lòng thử lại.' }, { status: 500 })
  }

  const { email_otp, hashed_token } = data.properties
  const link = `${appOrigin(req)}/auth/confirm?token_hash=${encodeURIComponent(hashed_token)}&type=magiclink`
  try {
    await sendLoginEmail(email, email_otp, link)
  } catch {
    console.error('[auth/request] gửi email thất bại')
    return Response.json({ error: 'Không gửi được email lúc này, vui lòng thử lại.' }, { status: 502 })
  }
  return Response.json(GENERIC)
}
