import type { ClientStatus, Gender, GoalGroup, PhaseStatus, TrainingType } from './types'

export type Client = {
  id: string
  full_name: string
  gender: Gender
  birth_date: string | null
  phone: string | null
  avatar_path: string | null
  start_date: string
  goals: GoalGroup[]
  training_type: TrainingType
  pt_id: string | null
  status: ClientStatus
  injuries: string | null
  surgeries: string | null
  joint_conditions: string | null
  doctor_orders: string | null
  avoid_movements: string | null
  health_flags: string[]
  is_kid: boolean
  guardian_name: string | null
  guardian_phone: string | null
  height_cm: number | null
  kid_notes: string | null
  enabled_metrics: string[]
  photo_consent: boolean
}

export type Package = { id: string; name: string; total_sessions: number; used_sessions: number; is_active: boolean; start_date: string }

export type Phase = {
  id: string; client_id: string; name: string; goal: string | null; start_date: string
  end_date: string | null; targets: string | null; sort_order: number; status: PhaseStatus
}

export const CLIENT_COLUMNS =
  'id, full_name, gender, birth_date, phone, avatar_path, start_date, goals, training_type, pt_id, status, injuries, surgeries, joint_conditions, doctor_orders, avoid_movements, health_flags, is_kid, guardian_name, guardian_phone, height_cm, kid_notes, enabled_metrics, photo_consent'

export function activePackage(pkgs: Package[] | null | undefined): Package | null {
  return (pkgs ?? []).filter((p) => p.is_active).sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0] ?? null
}

export function ageFrom(birth: string | null): number | null {
  if (!birth) return null
  const b = new Date(birth), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--
  return age
}

/** Giai đoạn hiện tại: đang thực hiện; nếu không có thì giai đoạn chứa ngày hôm nay; nếu không thì giai đoạn mới nhất đã bắt đầu. */
export function currentPhase<T extends Pick<Phase, 'status' | 'start_date' | 'end_date' | 'sort_order'>>(phases: T[], today: string): T | null {
  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order || (a.start_date < b.start_date ? -1 : 1))
  return sorted.find((p) => p.status === 'active')
    ?? sorted.find((p) => p.start_date <= today && (!p.end_date || p.end_date >= today))
    ?? [...sorted].reverse().find((p) => p.start_date <= today)
    ?? sorted[0] ?? null
}

/** Giai đoạn chứa một ngày đo (để gắn số đo / ảnh vào đúng giai đoạn) */
export function phaseForDate<T extends Pick<Phase, 'id' | 'start_date' | 'end_date' | 'sort_order'>>(phases: T[], date: string): T | null {
  const sorted = [...phases].sort((a, b) => (a.start_date < b.start_date ? -1 : 1))
  return sorted.find((p) => p.start_date <= date && (!p.end_date || p.end_date >= date))
    ?? [...sorted].reverse().find((p) => p.start_date <= date) ?? sorted[0] ?? null
}
