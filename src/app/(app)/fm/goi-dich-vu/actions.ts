'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'
import { ALL_FEATURES } from '@/lib/features'

const refresh = () => revalidatePath('/', 'layout')
const clean = (features: string[]) => [...new Set(features)].filter((f) => (ALL_FEATURES as string[]).includes(f))

export async function saveTier(input: { name: string; description: string; features: string[] }, id?: string) {
  return run(async () => {
    await requireApiRole('fm')
    const name = input.name.trim()
    if (!name) throw new HttpError(400, 'Vui lòng nhập tên gói.')
    const supabase = await createClient()
    const row = { name, description: input.description.trim() || null, features: clean(input.features) }
    if (id) must(await supabase.from('service_tiers').update(row).eq('id', id))
    else {
      const { data: last } = await supabase.from('service_tiers').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
      must(await supabase.from('service_tiers').insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 }))
    }
    refresh()
  })
}

/** Bật / tắt một tính năng của một gói (ô tích trong bảng) */
export async function toggleTierFeature(id: string, feature: string, on: boolean) {
  return run(async () => {
    await requireApiRole('fm')
    if (!(ALL_FEATURES as string[]).includes(feature)) throw new HttpError(400, 'Tính năng không hợp lệ.')
    const supabase = await createClient()
    const t = must(await supabase.from('service_tiers').select('features').eq('id', id).single())
    const set = new Set<string>(t.features)
    if (on) set.add(feature); else set.delete(feature)
    must(await supabase.from('service_tiers').update({ features: clean([...set]) }).eq('id', id))
    refresh()
  })
}

export async function setDefaultTier(id: string) {
  return run(async () => {
    await requireApiRole('fm')
    const supabase = await createClient()
    must(await supabase.from('service_tiers').update({ is_default: false }).eq('is_default', true))
    must(await supabase.from('service_tiers').update({ is_default: true }).eq('id', id))
    refresh()
  })
}

export async function deleteTier(id: string) {
  return run(async () => {
    await requireApiRole('fm')
    const supabase = await createClient()
    const t = must(await supabase.from('service_tiers').select('is_default').eq('id', id).single())
    if (t.is_default) throw new HttpError(400, 'Không xoá được gói mặc định. Hãy đặt gói khác làm mặc định trước.')
    must(await supabase.from('service_tiers').delete().eq('id', id)) // khách của gói này về gói mặc định
    refresh()
  })
}
