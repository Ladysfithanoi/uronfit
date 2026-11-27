'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'
import { parseDecimal, parseIntOrNull } from '@/lib/num'
import { MAX_SUPERSET, normalizeGroups, supersetBlocks } from '@/lib/superset'

const staff = () => requireApiRole('fm', 'pt')
const refresh = () => revalidatePath('/', 'layout')

export async function createWorkoutPlan(input: {
  name: string; phaseId?: string | null; groupId?: string | null; isTemplate?: boolean
  weeks: number; perWeek: number; templateId?: string | null
}) {
  return run(async () => {
    const me = await staff()
    const name = input.name.trim() || 'Giáo án'
    const supabase = await createClient()
    if (input.templateId) {
      const id = must(await supabase.rpc('clone_workout_plan', {
        src: input.templateId, new_name: name, to_phase: input.phaseId ?? null, to_group: input.groupId ?? null, as_template: !!input.isTemplate,
      })) as string
      refresh(); return { id }
    }
    const weeks = Math.min(Math.max(1, input.weeks || 1), 24)
    const per = Math.min(Math.max(1, input.perWeek || 1), 7)
    const plan = must(await supabase.from('workout_plans').insert({
      name, phase_id: input.phaseId ?? null, group_id: input.groupId ?? null, is_template: !!input.isTemplate, created_by: me.id,
    }).select('id').single())
    const sessions = []
    for (let w = 1; w <= weeks; w++) for (let d = 1; d <= per; d++) sessions.push({ plan_id: plan.id, week: w, day_order: d, title: `Buổi ${d}` })
    must(await supabase.from('workout_sessions').insert(sessions))
    refresh(); return { id: plan.id }
  })
}

export async function renamePlan(id: string, name: string) {
  return run(async () => {
    await staff()
    if (!name.trim()) throw new HttpError(400, 'Tên giáo án trống.')
    must(await (await createClient()).from('workout_plans').update({ name: name.trim() }).eq('id', id))
    refresh()
  })
}

export async function deletePlan(id: string) {
  return run(async () => {
    await staff()
    must(await (await createClient()).from('workout_plans').delete().eq('id', id))
    refresh()
  })
}

/** Nút "Chia sẻ": khách thấy giáo án ngay khi đăng nhập app */
export async function sharePlan(id: string, share: boolean) {
  return run(async () => {
    await staff()
    must(await (await createClient()).from('workout_plans').update({ shared_at: share ? new Date().toISOString() : null }).eq('id', id))
    refresh()
  })
}

export async function saveAsTemplate(id: string, name: string) {
  return run(async () => {
    await staff()
    const tid = must(await (await createClient()).rpc('clone_workout_plan', { src: id, new_name: name.trim() || 'Mẫu giáo án', as_template: true })) as string
    refresh(); return { id: tid }
  })
}

// ─── Buổi tập ───────────────────────────────────────────────────────────────
export async function addSession(planId: string, week: number) {
  return run(async () => {
    await staff()
    const supabase = await createClient()
    const { data: last } = await supabase.from('workout_sessions').select('day_order').eq('plan_id', planId).eq('week', week)
      .order('day_order', { ascending: false }).limit(1).maybeSingle()
    const day = (last?.day_order ?? 0) + 1
    must(await supabase.from('workout_sessions').insert({ plan_id: planId, week, day_order: day, title: `Buổi ${day}` }))
    refresh()
  })
}

/** Nhân bản một tuần thành tuần mới cuối giáo án (giữ bài, hiệp, lần lặp, tạ) */
export async function duplicateWeek(planId: string, week: number) {
  return run(async () => {
    await staff()
    const supabase = await createClient()
    const all = must(await supabase.from('workout_sessions').select('id, week, day_order, title, is_self_training').eq('plan_id', planId))
    const next = Math.max(...all.map((s) => s.week)) + 1
    for (const s of all.filter((x) => x.week === week)) {
      const ns = must(await supabase.from('workout_sessions').insert({ plan_id: planId, week: next, day_order: s.day_order, title: s.title, is_self_training: s.is_self_training }).select('id').single())
      const exs = must(await supabase.from('session_exercises').select('exercise_id, sort_order, sets, reps, duration_sec, weight_kg, rest_sec, notes, superset_group').eq('session_id', s.id).is('client_id', null))
      if (exs.length) must(await supabase.from('session_exercises').insert(exs.map((e) => ({ ...e, session_id: ns.id }))))
    }
    refresh(); return { week: next }
  })
}

export async function deleteWeek(planId: string, week: number) {
  return run(async () => {
    await staff()
    must(await (await createClient()).from('workout_sessions').delete().eq('plan_id', planId).eq('week', week))
    refresh()
  })
}

export async function updateSession(id: string, patch: { title?: string; scheduled_date?: string | null; is_self_training?: boolean }) {
  return run(async () => {
    await staff()
    must(await (await createClient()).from('workout_sessions').update(patch).eq('id', id))
    refresh()
  })
}

export async function deleteSession(id: string) {
  return run(async () => {
    await staff()
    must(await (await createClient()).from('workout_sessions').delete().eq('id', id))
    refresh()
  })
}

/** PT đánh dấu hoàn thành buổi, ghi tạ thực tế và nhận xét sau buổi */
export async function completeSession(id: string, input: { done: boolean; comment: string; actuals: { id: string; actual_weight_kg: string }[] }) {
  return run(async () => {
    const me = await staff()
    const supabase = await createClient()
    for (const a of input.actuals) {
      must(await supabase.from('session_exercises').update({ actual_weight_kg: parseDecimal(a.actual_weight_kg) }).eq('id', a.id))
    }
    must(await supabase.from('workout_sessions').update({
      completed_at: input.done ? new Date().toISOString() : null, completed_by: input.done ? me.id : null,
      comment: input.comment.trim() || null,
    }).eq('id', id))
    refresh()
  })
}

/** Khách tự đánh dấu buổi tự tập (qua hàm SQL kiểm tra quyền) */
export async function completeSelfSession(id: string, done: boolean) {
  return run(async () => {
    await requireApiRole('client', 'guardian')
    must(await (await createClient()).rpc('complete_self_session', { sid: id, done }))
    refresh()
  })
}

/** Điểm danh từng người trong buổi tập nhóm (có mặt tự trừ một buổi trong gói) */
export async function setAttendance(sessionId: string, clientId: string, present: boolean | null) {
  return run(async () => {
    const me = await staff()
    const supabase = await createClient()
    if (present === null) must(await supabase.from('attendance').delete().eq('session_id', sessionId).eq('client_id', clientId))
    else must(await supabase.from('attendance').upsert({ session_id: sessionId, client_id: clientId, present, marked_by: me.id }))
    refresh()
  })
}

// ─── Bài trong buổi ─────────────────────────────────────────────────────────
export type ExerciseParams = { sets: string; reps: string; duration_sec: string; weight_kg: string; rest_sec: string; notes: string }

function toRow(p: Partial<ExerciseParams>) {
  const row: Record<string, unknown> = {}
  if (p.sets !== undefined) row.sets = parseIntOrNull(p.sets)
  if (p.reps !== undefined) row.reps = p.reps.trim() || null
  if (p.duration_sec !== undefined) row.duration_sec = parseIntOrNull(p.duration_sec)
  if (p.weight_kg !== undefined) row.weight_kg = parseDecimal(p.weight_kg)
  if (p.rest_sec !== undefined) row.rest_sec = parseIntOrNull(p.rest_sec)
  if (p.notes !== undefined) row.notes = p.notes.trim() || null
  return row
}

export async function addSessionExercise(sessionId: string, exerciseId: string, opts?: { clientId?: string; replacesId?: string; params?: Partial<ExerciseParams> }) {
  return run(async () => {
    await staff()
    const supabase = await createClient()
    const { data: last } = await supabase.from('session_exercises').select('sort_order').eq('session_id', sessionId)
      .order('sort_order', { ascending: false }).limit(1).maybeSingle()
    must(await supabase.from('session_exercises').insert({
      session_id: sessionId, exercise_id: exerciseId, sort_order: (last?.sort_order ?? 0) + 1,
      client_id: opts?.clientId ?? null, replaces_id: opts?.replacesId ?? null,
      sets: 3, reps: '10', rest_sec: 60, ...toRow(opts?.params ?? {}),
    }))
    refresh()
  })
}

export async function updateSessionExercise(id: string, params: Partial<ExerciseParams> & { exercise_id?: string }) {
  return run(async () => {
    await staff()
    const row = toRow(params)
    if (params.exercise_id) row.exercise_id = params.exercise_id
    must(await (await createClient()).from('session_exercises').update(row).eq('id', id))
    refresh()
  })
}

export async function deleteSessionExercise(id: string) {
  return run(async () => {
    await staff()
    const supabase = await createClient()
    const { data: row } = await supabase.from('session_exercises').select('session_id').eq('id', id).maybeSingle()
    must(await supabase.from('session_exercises').delete().eq('id', id))
    if (row) await saveGroups(supabase, row.session_id)
    refresh()
  })
}

export async function moveSessionExercise(sessionId: string, id: string, dir: -1 | 1) {
  return run(async () => {
    await staff()
    const supabase = await createClient()
    const list = must(await supabase.from('session_exercises').select('id').eq('session_id', sessionId).is('client_id', null).order('sort_order'))
    const i = list.findIndex((x) => x.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    for (const [k, x] of list.entries()) must(await supabase.from('session_exercises').update({ sort_order: k + 1 }).eq('id', x.id))
    await saveGroups(supabase, sessionId)
    refresh()
  })
}

// ─── Superset ───────────────────────────────────────────────────────────────
type Db = Awaited<ReturnType<typeof createClient>>
type GroupRow = { id: string; superset_group: string | null }

/** Đọc nhóm của các bài chung trong buổi → áp thay đổi → chuẩn hoá chữ cái → ghi phần khác đi */
async function saveGroups(supabase: Db, sessionId: string, change?: (list: GroupRow[]) => void) {
  const list: GroupRow[] = must(await supabase.from('session_exercises').select('id, superset_group').eq('session_id', sessionId).is('client_id', null).order('sort_order'))
  const before = new Map(list.map((r) => [r.id, r.superset_group]))
  const work = list.map((r) => ({ ...r }))
  change?.(work)
  const fixed = new Map(normalizeGroups(work).map((r) => [r.id, r.superset_group]))
  for (const r of work) {
    const g = fixed.has(r.id) ? fixed.get(r.id)! : r.superset_group
    if (g !== before.get(r.id)) must(await supabase.from('session_exercises').update({ superset_group: g }).eq('id', r.id))
  }
}

/** Ghép bài với bài ngay dưới thành superset (gộp luôn nếu một trong hai đã thuộc nhóm) */
export async function linkSuperset(sessionId: string, id: string) {
  return run(async () => {
    await staff()
    const supabase = await createClient()
    await saveGroups(supabase, sessionId, (list) => {
      const i = list.findIndex((x) => x.id === id)
      if (i < 0 || i >= list.length - 1) throw new HttpError(400, 'Không có bài bên dưới để ghép.')
      const blocks = supersetBlocks(list)
      const a = blocks.find((b) => b.items.some((x) => x.e.id === id))!
      const b = blocks.find((bl) => bl.items.some((x) => x.e.id === list[i + 1].id))!
      if (a.items.length + b.items.length > MAX_SUPERSET) throw new HttpError(400, `Một nhóm superset tối đa ${MAX_SUPERSET} bài.`)
      for (const x of [...a.items, ...b.items]) x.e.superset_group = '*' // chữ tạm, chuẩn hoá ngay sau
    })
    refresh()
  })
}

/** Tách bài khỏi nhóm superset (nhóm còn 1 bài thì tự bỏ nhóm) */
export async function unlinkSuperset(sessionId: string, id: string) {
  return run(async () => {
    await staff()
    const supabase = await createClient()
    await saveGroups(supabase, sessionId, (list) => {
      const r = list.find((x) => x.id === id)
      if (r) r.superset_group = null
    })
    refresh()
  })
}
