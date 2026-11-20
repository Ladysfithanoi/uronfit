import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DEVICE_COOKIE } from '@/lib/devices'

// Đăng xuất trên máy này: xoá phiên + đánh dấu thiết bị đã đăng xuất.
// Lần sau đăng nhập lại trên máy này vẫn phải xác nhận qua email.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const key = (await cookies()).get(DEVICE_COOKIE)?.value
  if (user && key) {
    await createAdminClient().from('devices')
      .update({ revoked_at: new Date().toISOString(), session_id: null })
      .eq('user_id', user.id).eq('device_key', key)
  }
  await supabase.auth.signOut({ scope: 'local' })
  return Response.json({ ok: true })
}
