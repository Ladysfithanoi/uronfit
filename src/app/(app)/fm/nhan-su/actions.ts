'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createAccount, setAccountActive } from '@/lib/accounts'
import { createAdminClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'

export async function createPt(input: { fullName: string; email: string; phone?: string }) {
  return run(async () => {
    const me = await requireApiRole('fm')
    if (!input.fullName?.trim()) throw new Error('Vui lòng nhập họ tên.')
    const r = await createAccount({ email: input.email, fullName: input.fullName, role: 'pt', phone: input.phone, createdBy: me })
    revalidatePath('/fm/nhan-su')
    return r
  })
}

/**
 * Xoá hẳn tài khoản PT — chỉ FM.
 * Khách và nhóm của PT được chuyển sang `transferTo` (hoặc để "chưa gán" nếu null).
 * Giáo án, số đo, ghi chú, bài tập, mẫu PT đã tạo vẫn giữ (người tạo để trống → FM quản lý).
 */
export async function deletePt(id: string, transferTo: string | null) {
  return run(async () => {
    const me = await requireApiRole('fm')
    if (id === me.id) throw new HttpError(400, 'Không thể tự xoá tài khoản FM.')
    const admin = createAdminClient()
    const { data: pt } = await admin.from('profiles').select('role, full_name').eq('id', id).maybeSingle()
    if (pt?.role !== 'pt') throw new HttpError(400, 'Chỉ xoá được tài khoản PT ở đây.')
    if (transferTo) {
      if (transferTo === id) throw new HttpError(400, 'Hãy chọn một PT khác để nhận khách.')
      const { data: target } = await admin.from('profiles').select('role, is_active').eq('id', transferTo).maybeSingle()
      if (target?.role !== 'pt' || !target.is_active) throw new HttpError(400, 'PT nhận khách không hợp lệ hoặc đã bị khoá.')
    }

    must(await admin.from('clients').update({ pt_id: transferTo }).eq('pt_id', id))
    must(await admin.from('groups').update({ pt_id: transferTo }).eq('pt_id', id))
    await setAccountActive(id, false) // đăng xuất mọi thiết bị ngay

    const { error } = await admin.auth.admin.deleteUser(id) // xoá luôn hồ sơ (profiles … on delete cascade)
    if (error) throw new HttpError(500, 'Đã chuyển khách nhưng chưa xoá được tài khoản. Tài khoản đã bị khoá; vui lòng thử xoá lại.')
    revalidatePath('/', 'layout')
    return { name: pt.full_name }
  })
}

export async function setPtActive(id: string, active: boolean) {
  return run(async () => {
    await requireApiRole('fm')
    const { data } = await createAdminClient().from('profiles').select('role').eq('id', id).single()
    if (data?.role !== 'pt') throw new Error('Chỉ khoá được tài khoản PT ở đây.')
    await setAccountActive(id, active)
    revalidatePath('/fm/nhan-su')
  })
}
