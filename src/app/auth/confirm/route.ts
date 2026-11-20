import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { registerDevice } from '@/lib/devices'
import { homePath } from '@/lib/labels'
import { appOrigin } from '@/lib/origin'
import type { UserRole } from '@/lib/types'

// Người dùng bấm nút "Đăng nhập" trong email → đăng nhập trên trình duyệt mở link.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = (url.searchParams.get('type') ?? 'magiclink') as EmailOtpType
  const origin = appOrigin(req)

  if (token_hash) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error && data.session && data.user) {
      await registerDevice({
        userId: data.user.id, accessToken: data.session.access_token,
        userAgent: req.headers.get('user-agent'), origin,
      })
      const { data: profile } = await createAdminClient().from('profiles')
        .select('role').eq('id', data.user.id).single()
      return NextResponse.redirect(`${origin}${homePath((profile?.role ?? 'client') as UserRole)}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?loi=link-het-han`)
}
