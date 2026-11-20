import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { signedUrls } from '@/lib/storage'

export type PlanExercise = {
  id: string; session_id: string; exercise_id: string; client_id: string | null; replaces_id: string | null; sort_order: number
  sets: number | null; reps: string | null; duration_sec: number | null; weight_kg: number | null; rest_sec: number | null
  notes: string | null; actual_weight_kg: number | null
  exercise: { name: string; muscle_group: string | null; equipment: string | null; description: string | null
    video_url: string | null; image_url: string | null; tags: string[]; contraindications: string[] }
}
export type PlanSession = {
  id: string; week: number; day_order: number; title: string | null; scheduled_date: string | null
  is_self_training: boolean; completed_at: string | null; comment: string | null
  exercises: PlanExercise[]; attendance: { client_id: string; present: boolean }[]
}
export type PlanData = {
  id: string; name: string; phase_id: string | null; group_id: string | null; is_template: boolean; shared_at: string | null
  sessions: PlanSession[]
}

export async function loadPlan(planId: string): Promise<PlanData | null> {
  const supabase = await createClient()
  const { data: plan } = await supabase.from('workout_plans')
    .select('id, name, phase_id, group_id, is_template, shared_at').eq('id', planId).maybeSingle()
  if (!plan) return null
  return { ...plan, sessions: (await loadSessions([planId])).get(planId) ?? [] }
}

/** Buổi + bài + điểm danh của nhiều giáo án, gom theo plan_id */
export async function loadSessions(planIds: string[]): Promise<Map<string, PlanSession[]>> {
  const out = new Map<string, PlanSession[]>()
  if (!planIds.length) return out
  const supabase = await createClient()
  const { data: sessions } = await supabase.from('workout_sessions')
    .select('id, plan_id, week, day_order, title, scheduled_date, is_self_training, completed_at, comment')
    .in('plan_id', planIds).order('week').order('day_order')
  const ids = (sessions ?? []).map((s) => s.id)
  const [{ data: exs }, { data: att }] = ids.length
    ? await Promise.all([
        supabase.from('session_exercises')
          .select('id, session_id, exercise_id, client_id, replaces_id, sort_order, sets, reps, duration_sec, weight_kg, rest_sec, notes, actual_weight_kg, exercises(name, muscle_group, equipment, description, video_url, image_path, tags, contraindications)')
          .in('session_id', ids).order('sort_order'),
        supabase.from('attendance').select('session_id, client_id, present').in('session_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  type RawEx = { image_path: string | null } & Omit<PlanExercise['exercise'], 'image_url'>
  const urls = await signedUrls('exercise-media', (exs ?? []).map((e) => (e.exercises as unknown as RawEx | null)?.image_path))
  for (const s of sessions ?? []) {
    const list = out.get(s.plan_id) ?? []
    list.push({
      ...s,
      exercises: (exs ?? []).filter((e) => e.session_id === s.id).flatMap((e) => {
        const raw = e.exercises as unknown as RawEx | null
        if (!raw) return []
        const { image_path, ...rest } = raw
        return [{ ...e, exercises: undefined, exercise: { ...rest, image_url: image_path ? urls.get(image_path) ?? null : null } } as unknown as PlanExercise]
      }),
      attendance: (att ?? []).filter((a) => a.session_id === s.id).map(({ client_id, present }) => ({ client_id, present })),
    })
    out.set(s.plan_id, list)
  }
  return out
}

/** Tiến độ: buổi đã xong / tổng buổi */
export function planProgress(sessions: Pick<PlanSession, 'completed_at'>[]) {
  const total = sessions.length
  const done = sessions.filter((s) => s.completed_at).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}
