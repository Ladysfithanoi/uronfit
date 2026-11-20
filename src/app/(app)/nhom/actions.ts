'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'

export async function saveGroup(input: { name: string; type: 'one_on_two' | 'kids'; ptId: string | null; memberIds: string[] }, id?: string) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    if (!input.name.trim()) throw new HttpError(400, 'Vui lòng nhập tên nhóm.')
    const max = input.type === 'one_on_two' ? 2 : 3
    if (input.memberIds.length < 2 || input.memberIds.length > max) {
      throw new HttpError(400, input.type === 'one_on_two' ? 'Nhóm 1:2 cần đúng 2 khách.' : 'Nhóm trẻ em gồm 2–3 bé.')
    }
    const supabase = await createClient()
    const row = { name: input.name.trim(), type: input.type, pt_id: me.role === 'pt' ? me.id : input.ptId }
    let gid = id
    if (id) must(await supabase.from('groups').update(row).eq('id', id))
    else gid = must(await supabase.from('groups').insert(row).select('id').single()).id
    must(await supabase.from('group_members').delete().eq('group_id', gid!))
    must(await supabase.from('group_members').insert(input.memberIds.map((client_id) => ({ group_id: gid!, client_id }))))
    revalidatePath('/nhom', 'layout')
    return { id: gid! }
  })
}

export async function deleteGroup(id: string) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    must(await (await createClient()).from('groups').delete().eq('id', id))
    revalidatePath('/nhom', 'layout')
  })
}
