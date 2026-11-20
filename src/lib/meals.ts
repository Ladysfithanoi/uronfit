export type Meal = {
  id: string; day_number: number; meal_slot: string; dish: string; portion: string | null
  kcal: number | null; notes: string | null; sort_order: number
}
export type MealPlan = {
  id: string; name: string; phase_id: string | null; is_template: boolean; shared_at: string | null
  kcal: number | null; protein_g: number | null; carb_g: number | null; fat_g: number | null; created_at?: string
}

export const MEAL_SLOTS = ['Sáng', 'Phụ sáng', 'Trưa', 'Phụ chiều', 'Tối', 'Trước tập', 'Sau tập']
const SLOT_ORDER = new Map(MEAL_SLOTS.map((s, i) => [s, i]))

export function sortMeals(meals: Meal[]) {
  return [...meals].sort((a, b) =>
    (SLOT_ORDER.get(a.meal_slot) ?? 50) - (SLOT_ORDER.get(b.meal_slot) ?? 50) || a.sort_order - b.sort_order)
}

/** Ngày thực đơn áp dụng cho hôm nay: xoay vòng theo số ngày, tính từ ngày bắt đầu (giai đoạn / ngày chia sẻ) */
export function todayDayNumber(totalDays: number, startDate: string, today: string): number {
  if (totalDays <= 0) return 1
  const diff = Math.floor((Date.parse(today) - Date.parse(startDate)) / 86400000)
  return ((((diff % totalDays) + totalDays) % totalDays) + 1)
}
