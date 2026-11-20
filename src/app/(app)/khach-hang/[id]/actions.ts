'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'
import type { PhaseStatus } from '@/lib/types'

export type PhaseInput = {
  name: string; goal: string; start_date: string; end_date: string | null; targets: string; status: PhaseStatus
}

export async function savePhase(clientId: string, input: PhaseInput, id?: string) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    if (!input.name.trim()) throw new HttpError(400, 'Vui lòng nhập tên giai đoạn.')
    if (input.end_date && input.end_date < input.start_date) throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu.')
    const supabase = await createClient()
    const row = {
      name: input.name.trim(), goal: input.goal.trim() || null, start_date: input.start_date,
      end_date: input.end_date || null, targets: input.targets.trim() || null, status: input.status,
    }
    // Chỉ một giai đoạn "đang thực hiện" tại một thời điểm
    if (input.status === 'active') {
      let q = supabase.from('phases').update({ status: 'completed' }).eq('client_id', clientId).eq('status', 'active')
      if (id) q = q.neq('id', id)
      must(await q)
    }
    if (id) {
      must(await supabase.from('phases').update(row).eq('id', id))
    } else {
      const { data: last } = await supabase.from('phases').select('sort_order').eq('client_id', clientId)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle()
      must(await supabase.from('phases').insert({ ...row, client_id: clientId, sort_order: (last?.sort_order ?? 0) + 1 }))
    }
    revalidatePath(`/khach-hang/${clientId}`)
  })
}

export async function deletePhase(clientId: string, id: string) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    must(await supabase.from('phases').delete().eq('id', id).eq('client_id', clientId))
    revalidatePath(`/khach-hang/${clientId}`)
  })
}

export async function movePhase(clientId: string, id: string, dir: -1 | 1) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    const phases = must(await supabase.from('phases').select('id, sort_order').eq('client_id', clientId).order('sort_order'))
    const i = phases.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= phases.length) return
    ;[phases[i], phases[j]] = [phases[j], phases[i]]
    for (const [k, p] of phases.entries()) must(await supabase.from('phases').update({ sort_order: k + 1 }).eq('id', p.id))
    revalidatePath(`/khach-hang/${clientId}`)
  })
}

export async function addNote(clientId: string, content: string, coachOnly: boolean) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    if (!content.trim()) throw new HttpError(400, 'Ghi chú trống.')
    const supabase = await createClient()
    must(await supabase.from('notes').insert({ client_id: clientId, content: content.trim(), coach_only: coachOnly, author_id: me.id }))
    revalidatePath(`/khach-hang/${clientId}`)
  })
}

export async function deleteNote(clientId: string, id: string) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    must(await supabase.from('notes').delete().eq('id', id))
    revalidatePath(`/khach-hang/${clientId}`)
  })
}
