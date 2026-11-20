import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { homePath } from '@/lib/labels'

// proxy.ts thường đã chuyển hướng trước; đây là lưới an toàn.
export default async function Root() {
  const me = await getProfile()
  redirect(me ? homePath(me.role) : '/login')
}
