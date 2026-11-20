'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole } from '@/lib/auth'
import { createAccount, setAccountActive } from '@/lib/accounts'
import { createAdminClient } from '@/lib/supabase/server'
import { run } from '@/lib/action'

export async function createPt(input: { fullName: string; email: string; phone?: string }) {
  return run(async () => {
    const me = await requireApiRole('fm')
    if (!input.fullName?.trim()) throw new Error('Vui lòng nhập họ tên.')
    const r = await createAccount({ email: input.email, fullName: input.fullName, role: 'pt', phone: input.phone, createdBy: me })
    revalidatePath('/fm/nhan-su')
    return r
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
