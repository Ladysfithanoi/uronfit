import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Link ảnh có thời hạn (mặc định 1 giờ) từ kho riêng tư. Tạo bằng phiên của người
 * đang xem nên RLS của Storage quyết định ai được mở ảnh nào.
 */
export async function signedUrls(bucket: 'client-media' | 'exercise-media', paths: (string | null | undefined)[], expires = 3600) {
  const list = [...new Set(paths.filter((p): p is string => !!p))]
  const map = new Map<string, string>()
  if (!list.length) return map
  const supabase = await createClient()
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, expires)
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl)
  return map
}
