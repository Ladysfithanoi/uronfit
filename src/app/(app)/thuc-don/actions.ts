'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'
import { parseIntOrNull } from '@/lib/num'

const staff = () => requireApiRole('fm', 'pt')
const refresh = () => revalidatePath('/', 'layout')

export async function createMealPlan(input: {
  name: string; phaseId: string | null; isTemplate?: boolean; templateId?: string | null
  kcal: string; protein: string; carb: string; fat: string
}) {
  return run(async () => {
    const me = await staff()
    const supabase = await createClient()
    const name = input.name.trim() || 'Thực đơn'
    if (input.templateId) {
      const id = must(await supabase.rpc('clone_meal_plan', { src: input.templateId, new_name: name, to_phase: input.phaseId, as_template: !!input.isTemplate })) as string
      refresh(); return { id }
    }
    const plan = must(await supabase.from('meal_plans').insert({
      name, phase_id: input.phaseId, is_template: !!input.isTemplate, created_by: me.id,
      kcal: parseIntOrNull(input.kcal), protein_g: parseIntOrNull(input.protein), carb_g: parseIntOrNull(input.carb), fat_g: parseIntOrNull(input.fat),
    }).select('id').single())
    refresh(); return { id: plan.id }
  })
}

export async function updateMealPlan(id: string, input: { name: string; kcal: string; protein: string; carb: string; fat: string }) {
  return run(async () => {
    await staff()
    if (!input.name.trim()) throw new HttpError(400, 'Tên thực đơn trống.')
    must(await (await createClient()).from('meal_plans').update({
      name: input.name.trim(), kcal: parseIntOrNull(input.kcal), protein_g: parseIntOrNull(input.protein),
      carb_g: parseIntOrNull(input.carb), fat_g: parseIntOrNull(input.fat),
    }).eq('id', id))
    refresh()
  })
}

export async function deleteMealPlan(id: string) {
  return run(async () => { await staff(); must(await (await createClient()).from('meal_plans').delete().eq('id', id)); refresh() })
}

export async function shareMealPlan(id: string, share: boolean) {
  return run(async () => {
    await staff()
    must(await (await createClient()).from('meal_plans').update({ shared_at: share ? new Date().toISOString() : null }).eq('id', id))
    refresh()
  })
}

export async function saveMealAsTemplate(id: string, name: string) {
  return run(async () => {
    await staff()
    const tid = must(await (await createClient()).rpc('clone_meal_plan', { src: id, new_name: name.trim() || 'Mẫu thực đơn', as_template: true })) as string
    refresh(); return { id: tid }
  })
}

export type MealInput = { day_number: number; meal_slot: string; dish: string; portion: string; kcal: string; notes: string }

export async function saveMeal(planId: string, input: MealInput, id?: string) {
  return run(async () => {
    await staff()
    if (!input.dish.trim()) throw new HttpError(400, 'Vui lòng nhập tên món.')
    const supabase = await createClient()
    const row = {
      day_number: input.day_number, meal_slot: input.meal_slot.trim() || 'Bữa phụ', dish: input.dish.trim(),
      portion: input.portion.trim() || null, kcal: parseIntOrNull(input.kcal), notes: input.notes.trim() || null,
    }
    if (id) must(await supabase.from('meals').update(row).eq('id', id))
    else {
      const { data: last } = await supabase.from('meals').select('sort_order').eq('meal_plan_id', planId).eq('day_number', input.day_number)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle()
      must(await supabase.from('meals').insert({ ...row, meal_plan_id: planId, sort_order: (last?.sort_order ?? 0) + 1 }))
    }
    refresh()
  })
}

export async function deleteMeal(id: string) {
  return run(async () => { await staff(); must(await (await createClient()).from('meals').delete().eq('id', id)); refresh() })
}

/** Nhân bản một ngày thành ngày mới cuối thực đơn */
export async function duplicateDay(planId: string, day: number) {
  return run(async () => {
    await staff()
    const supabase = await createClient()
    const all = must(await supabase.from('meals').select('day_number, meal_slot, dish, portion, kcal, notes, sort_order').eq('meal_plan_id', planId))
    const next = Math.max(0, ...all.map((m) => m.day_number)) + 1
    const rows = all.filter((m) => m.day_number === day).map((m) => ({ ...m, day_number: next, meal_plan_id: planId }))
    if (rows.length) must(await supabase.from('meals').insert(rows))
    refresh(); return { day: next }
  })
}

export async function deleteDay(planId: string, day: number) {
  return run(async () => {
    await staff()
    must(await (await createClient()).from('meals').delete().eq('meal_plan_id', planId).eq('day_number', day))
    refresh()
  })
}
