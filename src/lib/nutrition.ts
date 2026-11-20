// Công cụ GỢI Ý calo & macro cho PT — cùng công thức với app diet-plan để hai app ra cùng số.
// App KHÔNG tự áp số cho khách: PT xem gợi ý, bấm "Dùng số này" rồi vẫn sửa tay được.
// Khoá với khách trẻ em và khách phục hồi chức năng (brief 4.4 — cần PT tự đánh giá).

export type BmrFormula = 'mifflin' | 'harris' | 'pyramid'
export type WeightGoal = 'lose' | 'maintain' | 'gain'

export const FORMULA_LABEL: Record<BmrFormula, string> = {
  mifflin: 'Mifflin St Jeor',
  harris: 'Harris Benedict',
  pyramid: 'Cân nặng × 22',
}

// PAL = mức vận động hằng ngày (bước chân) + mức tập luyện (gym)
export const STEP_LEVELS = [
  { pal: 0.6, label: 'Đi bộ dưới 2.000 bước/ngày' },
  { pal: 0.7, label: '2.000 – 4.999 bước/ngày' },
  { pal: 0.8, label: '5.000 – 6.999 bước/ngày' },
  { pal: 0.9, label: '7.000 – 9.999 bước/ngày' },
  { pal: 1.0, label: 'Trên 10.000 bước/ngày' },
]
export const GYM_LEVELS = [
  { pal: 0.55, label: 'Không tập gym' },
  { pal: 0.65, label: 'Tập 1–3 buổi/tuần' },
  { pal: 0.75, label: 'Tập 3–4 buổi/tuần' },
  { pal: 0.85, label: 'Tập từ 5 buổi/tuần' },
  { pal: 0.95, label: 'Tập 7 buổi/tuần, ~2 giờ/buổi' },
]
export const LOSS_SPEEDS = [
  { rate: 0.005, label: 'Giảm chậm (0,5% cân/tuần)' },
  { rate: 0.01, label: 'Giảm vừa (1% cân/tuần)' },
  { rate: 0.015, label: 'Giảm nhanh (1,5% cân/tuần)' },
]

const FAT_MIN = 40
const FAT_DEFAULT = 50

export function calcBMR(f: BmrFormula, male: boolean, kg: number, cm: number, age: number): number {
  if (f === 'mifflin') return 10 * kg + 6.25 * cm - 5 * age + (male ? 5 : -161)
  if (f === 'harris') return male ? 66.5 + 13.75 * kg + 5.003 * cm - 6.75 * age : 655.1 + 9.563 * kg + 1.85 * cm - 4.676 * age
  return kg * 22
}

export type Suggestion = {
  bmr: number; tdee: number; kcal: number; protein: number; fat: number; carb: number
  weekly: number | null // kg/tuần (âm = giảm)
  belowFloor: boolean   // calo mục tiêu thấp hơn mức tối thiểu dựng được thực đơn
}

export function suggest(input: {
  formula: BmrFormula; male: boolean; kg: number; cm: number; age: number
  step: number; gym: number; goal: WeightGoal; lossRate: number
}): Suggestion {
  const bmr = calcBMR(input.formula, input.male, input.kg, input.cm, input.age)
  const tdee = bmr * (STEP_LEVELS[input.step].pal + GYM_LEVELS[input.gym].pal)
  let kcal = tdee, weekly: number | null = null
  if (input.goal === 'lose') { weekly = -input.kg * input.lossRate; kcal = tdee + (weekly * 7700) / 7 }
  if (input.goal === 'gain') { weekly = input.kg * 0.005; kcal = tdee + Math.round((weekly * 7700) / 7) }
  // Đạm theo chiều cao; béo 50 g, hạ dần tới 40 g khi quỹ calo hẹp; còn lại là tinh bột
  const protein = Math.max(0, (input.cm - 100) * 0.9 * 2)
  const fat = Math.round(Math.max(FAT_MIN, Math.min(FAT_DEFAULT, (kcal - protein * 4) / 9)))
  const carb = Math.max(0, (kcal - protein * 4 - fat * 9) / 4)
  const floor = protein * 4 + FAT_MIN * 9
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal: Math.round(kcal),
    protein: Math.round(protein), fat, carb: Math.round(carb),
    weekly: weekly === null ? null : Math.round(weekly * 100) / 100, belowFloor: kcal < floor,
  }
}

/** Thông tin khách cho bộ gợi ý; blocked ≠ null → khoá công cụ */
export type CalcContext = {
  male: boolean; age: number | null; kg: number | null; cm: number | null
  defaultGoal: WeightGoal; blocked: string | null
}
