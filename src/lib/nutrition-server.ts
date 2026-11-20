import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { ageFrom } from '@/lib/clients'
import type { CalcContext } from '@/lib/nutrition'
import type { GoalGroup } from '@/lib/types'

/** Dữ liệu khách cho công cụ gợi ý calo (RLS: chỉ HLV quản lý khách mới đọc được) */
export async function calcContextFor(clientId: string): Promise<CalcContext | null> {
  const supabase = await createClient()
  const [{ data: c }, { data: w }] = await Promise.all([
    supabase.from('clients').select('gender, birth_date, height_cm, goals, is_kid').eq('id', clientId).maybeSingle(),
    supabase.from('measurements').select('value_num, metric_types!inner(name)')
      .eq('client_id', clientId).eq('metric_types.name', 'Cân nặng').not('value_num', 'is', null)
      .order('measured_on', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!c) return null
  const goals = c.goals as GoalGroup[]
  const blocked = c.is_kid || goals.includes('kids')
    ? 'Khách trẻ em: không dùng công thức người lớn. PT tự đánh giá và nhập mục tiêu.'
    : goals.includes('rehab')
      ? 'Khách phục hồi chức năng: cần PT tự đánh giá theo chỉ định chuyên môn, không dùng công thức gợi ý.'
      : null
  return {
    male: c.gender === 'male',
    age: ageFrom(c.birth_date),
    kg: w?.value_num != null ? Number(w.value_num) : null,
    cm: c.height_cm != null ? Number(c.height_cm) : null,
    defaultGoal: goals.includes('weight_gain') ? 'gain' : goals.includes('fat_loss') ? 'lose' : 'maintain',
    blocked,
  }
}
