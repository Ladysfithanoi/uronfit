import type { GoalGroup } from './types'

export type MetricType = {
  id: string; name: string; unit: string | null; kind: 'number' | 'text'; goal: GoalGroup | null
  client_id: string | null; is_default: boolean; default_enabled: boolean; client_can_enter: boolean; sort_order: number
}
export type Measurement = {
  id: string; metric_type_id: string; measured_on: string; value_num: number | null; value_text: string | null
  phase_id: string | null; source: 'staff' | 'client'; measured_by: string | null
}

/**
 * Bộ chỉ số theo nhóm mục tiêu (brief 4.5):
 *  - giảm mỡ / tăng cân: cân nặng + số đo vòng (+ % mỡ, khối cơ nếu PT bật)
 *  - chỉnh dáng, phục hồi, trẻ em: bộ riêng; cân nặng dùng chung
 *  - chỉ số tuỳ chỉnh của riêng khách
 */
export function metricsForClient(all: MetricType[], clientId: string, goals: GoalGroup[], enabled: string[]): MetricType[] {
  const g = new Set<GoalGroup>(goals)
  if (g.has('weight_gain')) g.add('fat_loss') // dùng chung bộ cân + vòng
  return all
    .filter((m) => {
      if (m.client_id) return m.client_id === clientId
      if (!m.default_enabled && !enabled.includes(m.id)) return false
      return m.goal === null || g.has(m.goal)
    })
    .sort((a, b) => a.sort_order - b.sort_order)
}

/** Chỉ số tuỳ chọn (mặc định tắt) mà PT có thể bật cho khách */
export function optionalMetrics(all: MetricType[], goals: GoalGroup[]): MetricType[] {
  const g = new Set<GoalGroup>(goals)
  if (g.has('weight_gain')) g.add('fat_loss')
  return all.filter((m) => !m.client_id && !m.default_enabled && (m.goal === null || g.has(m.goal)))
}

// ─── Trung bình theo tuần (ý từ app Chisu) ─────────────────────────────────
// Cân nặng dao động 0,5–1 kg mỗi ngày do nước/muối; trung bình tuần cho thấy xu hướng thật.
export function weekStartOf(date: string): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function weeklyAverages(points: { date: string; value: number }[]) {
  const buckets = new Map<string, number[]>()
  for (const p of points) {
    const w = weekStartOf(p.date)
    buckets.set(w, [...(buckets.get(w) ?? []), p.value])
  }
  return [...buckets.entries()]
    .map(([week, vals]) => ({ week, avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, count: vals.length }))
    .sort((a, b) => (a.week < b.week ? -1 : 1))
}
