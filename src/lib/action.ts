import 'server-only'
import { HttpError } from '@/lib/auth'

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

/** Lỗi Postgres/RLS → câu tiếng Việt; không đưa dữ liệu sức khoẻ vào log. */
export function friendlyError(e: unknown): string {
  if (e instanceof HttpError) return e.message
  const err = e as { code?: string; message?: string } | null
  const msg = err?.message ?? ''
  if (err?.code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err?.code === '23505') return 'Dữ liệu này đã tồn tại.'
  if (err?.code === '23503') return 'Không xoá được vì dữ liệu đang được dùng ở nơi khác.'
  if (err?.code === '23514' || err?.code === '22P02') return 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.'
  if (msg && /[À-ỹ]/.test(msg)) return msg // lỗi do chính app/DB raise bằng tiếng Việt
  console.error('[action] lỗi:', err?.code ?? (e instanceof Error ? e.name : 'unknown'))
  return 'Đã có lỗi xảy ra, vui lòng thử lại.'
}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: friendlyError(e) }
  }
}

/** Ném lỗi của supabase-js để run() bắt */
export function must<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error
  return res.data as NonNullable<T>
}
