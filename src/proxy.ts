import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 Proxy (trước đây là Middleware).
 *  1. Làm mới phiên Supabase.
 *  2. Chặn thiết bị chưa xác nhận qua email hoặc đã bị đăng xuất từ xa.
 *  3. Đưa mỗi vai trò về đúng khu vực: /fm (FM), /pt (PT), /me (khách, phụ huynh).
 * Lưu ý: đây chỉ là lớp điều hướng. Phân quyền dữ liệu thật nằm ở RLS trong Postgres.
 */
const DEVICE_COOKIE = 'urg_device'

const HOME: Record<string, string> = { fm: '/fm', pt: '/pt', client: '/me', guardian: '/me' }
const AREA_ROLES: [prefix: string, roles: string[]][] = [
  ['/fm', ['fm']],
  ['/pt', ['pt']],
  ['/me', ['client', 'guardian']],
  // Màn dùng chung cho HLV — dữ liệu mỗi người thấy do RLS quyết định
  ['/khach-hang', ['fm', 'pt']],
  ['/thu-vien', ['fm', 'pt']],
  ['/nhom', ['fm', 'pt']],
  ['/giao-an', ['fm', 'pt']],
  ['/thuc-don', ['fm', 'pt']],
]

function isPublic(path: string) {
  return (
    path === '/login' ||
    path.startsWith('/auth/') ||
    path.startsWith('/api/auth/') ||
    // PWA: trình duyệt tải manifest/service worker bằng request riêng, không kèm cookie
    path === '/manifest.webmanifest' ||
    path === '/sw.js' ||
    path === '/offline.html' ||
    path.startsWith('/brand/')
  )
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next({ request })

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Làm mới phiên — KHÔNG xoá lệnh này
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api/')

  // Chuyển hướng nhưng giữ cookie phiên vừa được làm mới / xoá
  const redirectTo = (to: string) => {
    const target = request.nextUrl.clone()
    const [p, qs] = to.split('?')
    target.pathname = p
    target.search = qs ? `?${qs}` : ''
    const res = NextResponse.redirect(target)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }
  const deny = (status: number, error: string) => {
    const res = NextResponse.json({ error }, { status })
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  if (!user) {
    if (isPublic(path)) return response
    return isApi ? deny(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.') : redirectTo('/login')
  }

  if (isPublic(path) && path !== '/login') return response

  // Một truy vấn: vai trò + trạng thái thiết bị (xem supabase/migrations/004_device_gate.sql)
  const deviceKey = request.cookies.get(DEVICE_COOKIE)?.value ?? ''
  const { data: gate } = await supabase.rpc('session_gate', { dkey: deviceKey })
  const row = Array.isArray(gate) ? gate[0] : null

  if (!row || row.device_status !== 'ok') {
    await supabase.auth.signOut({ scope: 'local' })
    if (path === '/login') return response
    const reason = !row ? 'tai-khoan' : row.device_status === 'revoked' ? 'da-dang-xuat' : 'thiet-bi'
    return isApi ? deny(401, 'Thiết bị này cần đăng nhập lại.') : redirectTo(`/login?loi=${reason}`)
  }

  const home = HOME[row.role] ?? '/login'
  if (path === '/login' || path === '/') return redirectTo(home)

  for (const [prefix, roles] of AREA_ROLES) {
    if ((path === prefix || path.startsWith(prefix + '/')) && !roles.includes(row.role)) {
      return isApi ? deny(403, 'Bạn không có quyền truy cập.') : redirectTo(home)
    }
  }
  return response
}

export const config = {
  matcher: [
    // Mọi đường dẫn TRỪ file tĩnh và nội bộ của Next
    '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
