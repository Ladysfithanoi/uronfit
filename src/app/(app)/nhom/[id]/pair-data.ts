import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { todayVN } from '@/lib/date'
import { currentPhase, type Phase } from '@/lib/clients'
import { metricsForClient, type Measurement, type MetricType } from '@/lib/metrics'
import { GOAL_LABEL } from '@/lib/labels'
import type { GoalGroup } from '@/lib/types'
import type { PairPerson } from './PairBoard'

type PlanRow = { phase_id: string; workout_sessions: { completed_at: string | null }[] }

/** Dữ liệu theo dõi song song — trang nhóm chỉ dành cho HLV, RLS lọc theo quyền từng khách */
export async function loadPairBoard(ids: string[]): Promise<PairPerson[]> {
  if (!ids.length) return []
  const supabase = await createClient()
  const [{ data: clients }, { data: types }, { data: phases }] = await Promise.all([
    supabase.from('clients').select('id, full_name, goals, enabled_metrics').in('id', ids),
    supabase.from('metric_types').select('*'),
    supabase.from('phases').select('*').in('client_id', ids),
  ])
  const phaseIds = (phases ?? []).map((p) => p.id)
  const { data: plans } = phaseIds.length
    ? await supabase.from('workout_plans').select('phase_id, workout_sessions(completed_at)').in('phase_id', phaseIds)
    : { data: [] as PlanRow[] }

  return Promise.all(ids.flatMap((id) => {
    const c = (clients ?? []).find((x) => x.id === id)
    return c ? [c] : []
  }).map(async (c) => {
    const measurements: Measurement[] = []
    for (let from = 0; ; from += 1000) { // Supabase trả tối đa 1000 dòng mỗi lần
      const { data } = await supabase.from('measurements').select('id, metric_type_id, measured_on, value_num, value_text, phase_id, source, measured_by')
        .eq('client_id', c.id).order('measured_on').order('id').range(from, from + 999)
      measurements.push(...((data ?? []) as Measurement[]))
      if ((data?.length ?? 0) < 1000) break
    }
    const own = ((phases ?? []) as Phase[]).filter((p) => p.client_id === c.id)
    const ownIds = new Set(own.map((p) => p.id))
    const sessions = ((plans ?? []) as PlanRow[]).filter((p) => ownIds.has(p.phase_id)).flatMap((p) => p.workout_sessions)
    const ph = currentPhase(own, todayVN())
    return {
      id: c.id, name: c.full_name, goals: (c.goals as GoalGroup[]).map((g) => GOAL_LABEL[g]),
      phase: ph ? { name: ph.name, start: ph.start_date, end: ph.end_date } : null,
      ownDone: sessions.filter((s) => s.completed_at).length, ownTotal: sessions.length,
      metrics: metricsForClient((types ?? []) as MetricType[], c.id, c.goals as GoalGroup[], c.enabled_metrics ?? []),
      measurements,
    }
  }))
}
