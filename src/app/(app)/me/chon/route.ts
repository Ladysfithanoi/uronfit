import { NextResponse } from 'next/server'

// Ghi nhớ bé đang xem (phụ huynh nhiều bé) rồi quay lại trang trước.
// Cookie chỉ chứa id hồ sơ; quyền xem vẫn do RLS kiểm tra mỗi lần tải.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const be = url.searchParams.get('be') ?? ''
  const next = url.searchParams.get('next') ?? '/me'
  const safeNext = next.startsWith('/me') ? next : '/me'
  const res = NextResponse.redirect(new URL(safeNext, url.origin))
  if (/^[0-9a-f-]{36}$/i.test(be)) {
    res.cookies.set('urg_be', be, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180, secure: (req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')) === 'https' })
  }
  return res
}
