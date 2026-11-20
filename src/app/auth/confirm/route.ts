import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { registerDevice } from '@/lib/devices'
import { checkLoginLink, startSession } from '@/lib/login-code'
import { homePath } from '@/lib/labels'
import { appOrigin } from '@/lib/origin'
import type { UserRole } from '@/lib/types'

// Người dùng bấm nút "Đăng nhập" trong email → đăng nhập trên trình duyệt mở link.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('t')
  const origin = appOrigin(req)

  if (token) {
    const check = await checkLoginLink(token)
    if (check.ok) {
      const s = await startSession(check.email)
      if (s) {
        await registerDevice({
          userId: s.user!.id, accessToken: s.session!.access_token,
          userAgent: req.headers.get('user-agent'), origin,
        })
        const { data: profile } = await createAdminClient().from('profiles').select('role').eq('id', s.user!.id).single()
        return NextResponse.redirect(`${origin}${homePath((profile?.role ?? 'client') as UserRole)}`)
      }
    }
  }
  return NextResponse.redirect(`${origin}/login?loi=link-het-han`)
}
