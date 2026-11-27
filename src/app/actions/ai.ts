'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'
import { ageFrom, currentPhase, type Phase } from '@/lib/clients'
import { todayVN } from '@/lib/date'
import { parseIntOrNull } from '@/lib/num'
import { suggest } from '@/lib/nutrition'
import { generateMealDay, mealCountProblem } from '@/lib/ai/meal-engine'
import { generateGeminiJson, geminiConfigured } from '@/lib/ai/gemini'
import {
  buildFallbackPlan, buildPrompt, prepareLibrary, sanitizeAnswers, sanitizePlan, supersetMode, PLAN_SCHEMA,
  type ClientContext, type LibraryExercise, type PlanDay, type WorkoutAnswers,
} from '@/lib/ai/workout'
import type { GoalGroup } from '@/lib/types'

/** Kiểm tra quyền với khách bằng chính RLS và lấy thông tin cần cho AI */
async function loadClient(clientId: string) {
  const supabase = await createClient()
  const { data: ok } = await supabase.rpc('can_manage_client', { cid: clientId })
  if (!ok) throw new HttpError(403, 'Bạn không có quyền với khách này.')
  const { data: c } = await supabase.from('clients')
    .select('id, full_name, gender, birth_date, height_cm, goals, is_kid, health_flags, injuries, surgeries, joint_conditions, doctor_orders, avoid_movements, start_date')
    .eq('id', clientId).single()
  if (!c) throw new HttpError(404, 'Không tìm thấy khách.')
  return { supabase, c }
}

/** Giai đoạn hiện tại của khách; chưa có → tạo "Giai đoạn 1" bắt đầu hôm nay. */
async function ensurePhase(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string, weeks: number, phaseId?: string | null) {
  if (phaseId) return phaseId
  const today = todayVN()
  const { data: phases } = await supabase.from('phases').select('*').eq('client_id', clientId).order('sort_order')
  const cur = currentPhase((phases ?? []) as Phase[], today)
  if (cur) return cur.id
  const end = new Date(Date.parse(today) + weeks * 7 * 86400000).toISOString().slice(0, 10)
  const row = must(await supabase.from('phases').insert({
    client_id: clientId, name: 'Giai đoạn 1', start_date: today, end_date: end, status: 'active', sort_order: 1,
  }).select('id').single())
  return row.id
}

export async function ensureFirstPhase(clientId: string, weeks = 4) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    const { supabase } = await loadClient(clientId)
    return { phaseId: await ensurePhase(supabase, clientId, weeks) }
  })
}

/** Cân nặng nhập khi tạo khách → lần đo đầu tiên (nguồn: HLV) */
export async function recordInitialWeight(clientId: string, kgRaw: string) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    const kg = Number(String(kgRaw).replace(',', '.'))
    if (!Number.isFinite(kg) || kg < 10 || kg > 300) throw new HttpError(400, 'Cân nặng không hợp lệ.')
    const { supabase } = await loadClient(clientId)
    const { data: t } = await supabase.from('metric_types').select('id').eq('name', 'Cân nặng').is('client_id', null).maybeSingle()
    if (!t) return
    const pid = await ensurePhase(supabase, clientId, 4)
    must(await supabase.from('measurements').upsert({
      client_id: clientId, metric_type_id: t.id, measured_on: todayVN(), value_num: kg, phase_id: pid, measured_by: me.id, source: 'staff',
    }, { onConflict: 'client_id,metric_type_id,measured_on' }))
  })
}

// ─── Lịch tập ────────────────────────────────────────────────────────────────
export async function aiCreateWorkoutPlan(clientId: string, rawAnswers: Partial<WorkoutAnswers>, phaseId?: string | null) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    const answers = sanitizeAnswers(rawAnswers)
    const { supabase, c } = await loadClient(clientId)

    const ctx: ClientContext = {
      gender: c.gender, age: ageFrom(c.birth_date), goals: c.goals as GoalGroup[], isKid: c.is_kid,
      healthFlags: c.health_flags ?? [],
      healthText: [
        c.injuries && `Chấn thương: ${c.injuries}`, c.surgeries && `Phẫu thuật: ${c.surgeries}`,
        c.joint_conditions && `Bệnh lý xương khớp: ${c.joint_conditions}`, c.doctor_orders && `Chỉ định bác sĩ: ${c.doctor_orders}`,
        c.avoid_movements && `Động tác cần tránh: ${c.avoid_movements}`,
      ].filter(Boolean).join('; '),
    }
    const { data: all } = await supabase.from('exercises').select('id, name, muscle_group, equipment, tags, contraindications')
    const { library, excludedForSafety } = prepareLibrary((all ?? []) as LibraryExercise[], answers, ctx)
    if (library.length < 6) throw new HttpError(400, 'Thư viện còn quá ít bài phù hợp để dựng lịch tập.')

    let days: PlanDay[] = []
    let name = answers.name
    let usedAi = false
    if (geminiConfigured()) {
      try {
        const { system, prompt, refToEx } = buildPrompt(answers, ctx, library)
        const raw = await generateGeminiJson({ system, prompt, schema: PLAN_SCHEMA, temperature: 0.6, maxOutputTokens: 6000, budgetMs: 45_000 })
        const plan = sanitizePlan(raw, refToEx, answers.sessionsPerWeek, supersetMode(answers, ctx) !== 'none')
        if (plan.days.length) { days = plan.days; name = answers.name || plan.name; usedAi = true }
      } catch (e) { console.error('[ai/workout] dựng theo quy tắc:', e instanceof Error ? e.message : e) }
    }
    if (!days.length) days = buildFallbackPlan(answers, ctx, library)
    if (!days.length) throw new HttpError(500, 'Không dựng được lịch tập. Vui lòng thử lại.')

    const pid = await ensurePhase(supabase, clientId, answers.weeks, phaseId)
    const plan = must(await supabase.from('workout_plans').insert({
      name: name || `Giáo án ${answers.weeks} tuần`, phase_id: pid, created_by: me.id,
    }).select('id').single())

    // Tuần mẫu lặp lại cho mọi tuần — PT tự tăng tải theo tiến độ
    for (let w = 1; w <= answers.weeks; w++) {
      for (const [i, d] of days.entries()) {
        const s = must(await supabase.from('workout_sessions').insert({ plan_id: plan.id, week: w, day_order: i + 1, title: d.label }).select('id').single())
        must(await supabase.from('session_exercises').insert(d.exercises.map((e, k) => ({
          session_id: s.id, exercise_id: e.exercise_id, sort_order: k + 1, sets: e.sets, reps: e.reps,
          duration_sec: e.duration_sec, rest_sec: e.rest_sec, notes: e.note, superset_group: e.superset,
        }))))
      }
    }
    revalidatePath(`/khach-hang/${clientId}`)
    return { id: plan.id, usedAi, sessions: days.length * answers.weeks, excludedForSafety }
  })
}

// ─── Thực đơn ────────────────────────────────────────────────────────────────
// Tên bữa theo số bữa — khớp mẫu bữa của bộ giải (sáng / chính / phụ)
const SLOTS: Record<number, string[]> = {
  2: ['Sáng', 'Tối'], 3: ['Sáng', 'Trưa', 'Tối'], 4: ['Sáng', 'Trưa', 'Phụ chiều', 'Tối'],
  5: ['Sáng', 'Phụ sáng', 'Trưa', 'Phụ chiều', 'Tối'],
}

export type AiMealInput = {
  name: string; mealCount: number; days: number; kcal: string; protein: string; carb: string; fat: string
  likes: string; dislikes: string; weightKg?: string
}

export async function aiCreateMealPlan(clientId: string, input: AiMealInput, phaseId?: string | null) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    const { supabase, c } = await loadClient(clientId)
    const goals = c.goals as GoalGroup[]
    if (c.is_kid || goals.includes('kids')) throw new HttpError(400, 'Khách trẻ em: không tạo thực đơn tự động. PT tự lên thực đơn.')
    if (goals.includes('rehab')) throw new HttpError(400, 'Khách phục hồi chức năng: không tạo thực đơn tự động. PT tự lên thực đơn theo chỉ định chuyên môn.')

    const mealCount = Math.min(5, Math.max(2, Math.round(Number(input.mealCount) || 3)))
    const dayCount = Math.min(7, Math.max(1, Math.round(Number(input.days) || 3)))

    // Mục tiêu: PT nhập; thiếu thì gợi ý theo công thức (cân nặng, chiều cao, tuổi)
    let kcal = parseIntOrNull(input.kcal), protein = parseIntOrNull(input.protein)
    let carb = parseIntOrNull(input.carb), fat = parseIntOrNull(input.fat)
    if (!kcal) {
      const { data: w } = await supabase.from('measurements').select('value_num, metric_types!inner(name)').eq('client_id', clientId)
        .eq('metric_types.name', 'Cân nặng').order('measured_on', { ascending: false }).limit(1).maybeSingle()
      const kg = (w?.value_num != null ? Number(w.value_num) : null) ?? parseIntOrNull(input.weightKg ?? '')
      const age = ageFrom(c.birth_date), cm = c.height_cm != null ? Number(c.height_cm) : null
      if (!kg || !cm || !age) throw new HttpError(400, 'Cần calo mục tiêu, hoặc đủ cân nặng + chiều cao + ngày sinh của khách để app tự gợi ý.')
      const s = suggest({ formula: 'mifflin', male: c.gender === 'male', kg, cm, age, step: 1, gym: 1,
        goal: goals.includes('weight_gain') ? 'gain' : goals.includes('fat_loss') ? 'lose' : 'maintain', lossRate: 0.005 })
      kcal = s.kcal; protein = protein ?? s.protein; carb = carb ?? s.carb; fat = fat ?? s.fat
    }
    if (!protein || !carb || !fat) {
      // Chia macro mặc định khi PT chỉ nhập calo: đạm 30%, béo 25%, tinh bột 45%
      protein = protein ?? Math.round((kcal * 0.3) / 4); fat = fat ?? Math.round((kcal * 0.25) / 9); carb = carb ?? Math.round((kcal * 0.45) / 4)
    }
    const problem = mealCountProblem(mealCount, kcal)
    if (problem) throw new HttpError(400, problem)

    const macros = { calories: kcal, protein, fat, carbs: carb }
    const prefs = { likes: input.likes?.trim().slice(0, 200), dislikes: input.dislikes?.trim().slice(0, 200) }
    const results = await Promise.all(Array.from({ length: dayCount }, () => generateMealDay(macros, mealCount, prefs)))

    const pid = await ensurePhase(supabase, clientId, 4, phaseId)
    const plan = must(await supabase.from('meal_plans').insert({
      name: input.name?.trim() || `Thực đơn ${kcal} kcal`, phase_id: pid, created_by: me.id,
      kcal, protein_g: protein, carb_g: carb, fat_g: fat,
    }).select('id').single())
    const slots = SLOTS[mealCount]
    const rows = results.flatMap((day, d) => day.meals.map((m, i) => ({
      meal_plan_id: plan.id, day_number: d + 1, meal_slot: slots[m.slotIndex] ?? `Bữa ${m.slotIndex + 1}`,
      dish: m.dish, kcal: m.kcal, sort_order: i,
      notes: `Đạm ${m.protein}g · Tinh bột ${m.carbs}g · Béo ${m.fat}g`,
    })))
    must(await supabase.from('meals').insert(rows))
    revalidatePath(`/khach-hang/${clientId}`)
    return { id: plan.id, usedAi: results.some((r) => r.usedAi), days: dayCount, kcal }
  })
}
