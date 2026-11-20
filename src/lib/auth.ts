import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { homePath } from '@/lib/labels'
import type { Profile, UserRole } from '@/lib/types'

/** Hồ sơ người đang đăng nhập (null nếu chưa đăng nhập / tài khoản bị khoá). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = data as Profile | null
  return profile?.is_active ? profile : null
})

/** Dùng trong trang: chưa đăng nhập → /login; sai vai trò → về trang chủ của mình. */
export async function requirePageRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (roles.length && !roles.includes(profile.role)) redirect(homePath(profile.role))
  return profile
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Dùng trong API route: ném HttpError 401/403. */
export async function requireApiRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  if (roles.length && !roles.includes(profile.role)) throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này.')
  return profile
}

/** Chuyển lỗi thành JSON, KHÔNG đưa chi tiết dữ liệu (sức khoẻ, trẻ em) vào log. */
export function apiError(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status })
  console.error('[api] lỗi không mong đợi:', e instanceof Error ? e.name : 'unknown')
  return Response.json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại.' }, { status: 500 })
}
