'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Field, ChipGroup } from '@/components/form/Field'
import { CalorieSuggest } from '@/components/meals/CalorieSuggest'
import { cleanDecimalInput } from '@/lib/num'
import type { CalcContext } from '@/lib/nutrition'

export const FOCUS = ['Mông', 'Đùi', 'Lưng', 'Ngực', 'Vai', 'Tay', 'Bụng / Core']

export type WorkoutForm = {
  name: string; level: 'beginner' | 'intermediate' | 'advanced'; sessionsPerWeek: number; sessionMinutes: number
  weeks: number; equipment: 'full_gym' | 'machines_dumbbells' | 'home_minimal'; focusMuscles: string[]; notes: string
}
export const defaultWorkout = (): WorkoutForm => ({
  name: '', level: 'beginner', sessionsPerWeek: 3, sessionMinutes: 60, weeks: 4, equipment: 'full_gym', focusMuscles: [], notes: '',
})

export type MealForm = { name: string; mealCount: number; days: number; kcal: string; protein: string; carb: string; fat: string; likes: string; dislikes: string; weightKg: string }
export const defaultMeal = (): MealForm => ({ name: '', mealCount: 3, days: 3, kcal: '', protein: '', carb: '', fat: '', likes: '', dislikes: '', weightKg: '' })

export function AiWorkoutFields({ value: f, onChange }: { value: WorkoutForm; onChange: (v: WorkoutForm) => void }) {
  const set = <K extends keyof WorkoutForm>(k: K, v: WorkoutForm[K]) => onChange({ ...f, [k]: v })
  return (
    <div className="space-y-4">
      <Field label="Trình độ">
        <ChipGroup options={[{ value: 'beginner', label: 'Mới tập' }, { value: 'intermediate', label: 'Trung cấp' }, { value: 'advanced', label: 'Nâng cao' }]}
          value={[f.level]} onChange={(v) => set('level', v[0] as WorkoutForm['level'])} />
      </Field>
      <div className="grid grid-cols-3 items-end gap-3">
        <Field label="Buổi / tuần" htmlFor="aw-per">
          <NativeSelect id="aw-per" value={f.sessionsPerWeek} onChange={(e) => set('sessionsPerWeek', Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Phút / buổi" htmlFor="aw-min">
          <NativeSelect id="aw-min" value={f.sessionMinutes} onChange={(e) => set('sessionMinutes', Number(e.target.value))}>
            {[30, 45, 60, 75, 90].map((n) => <option key={n} value={n}>{n}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Số tuần" htmlFor="aw-weeks">
          <NativeSelect id="aw-weeks" value={f.weeks} onChange={(e) => set('weeks', Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Dụng cụ" htmlFor="aw-eq">
        <NativeSelect id="aw-eq" value={f.equipment} onChange={(e) => set('equipment', e.target.value as WorkoutForm['equipment'])}>
          <option value="full_gym">Phòng gym đầy đủ</option>
          <option value="machines_dumbbells">Máy, cáp, tạ đơn (không tạ đòn)</option>
          <option value="home_minimal">Tại nhà (tạ đơn, dây, trọng lượng cơ thể)</option>
        </NativeSelect>
      </Field>
      <Field label="Nhóm cơ ưu tiên (tuỳ chọn)">
        <ChipGroup multiple options={FOCUS.map((m) => ({ value: m, label: m }))} value={f.focusMuscles} onChange={(v) => set('focusMuscles', v)} />
      </Field>
      <Field label="Ghi chú cho AI (tuỳ chọn)" htmlFor="aw-notes" hint="Vd: ưu tiên mông, tránh bật nhảy, khách hay đau gối khi squat sâu…">
        <Textarea id="aw-notes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
    </div>
  )
}

export function AiMealFields({ value: f, onChange, calc, askWeight }: {
  value: MealForm; onChange: (v: MealForm) => void; calc?: CalcContext | null; askWeight?: boolean
}) {
  const set = <K extends keyof MealForm>(k: K, v: MealForm[K]) => onChange({ ...f, [k]: v })
  const num = (k: 'kcal' | 'protein' | 'carb' | 'fat') => (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value.replace(/\D/g, ''))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Số bữa / ngày" htmlFor="am-meals">
          <NativeSelect id="am-meals" value={f.mealCount} onChange={(e) => set('mealCount', Number(e.target.value))}>
            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} bữa</option>)}
          </NativeSelect>
        </Field>
        <Field label="Số ngày thực đơn" htmlFor="am-days">
          <NativeSelect id="am-days" value={f.days} onChange={(e) => set('days', Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} ngày</option>)}
          </NativeSelect>
        </Field>
      </div>
      {askWeight && (
        <Field label="Cân nặng hiện tại (kg)" htmlFor="am-kg" hint="Lưu luôn làm lần đo đầu tiên; dùng để gợi ý calo nếu bạn để trống mục tiêu.">
          <Input id="am-kg" inputMode="decimal" value={f.weightKg} onChange={(e) => set('weightKg', cleanDecimalInput(e.target.value))} />
        </Field>
      )}
      <p className="text-xs text-muted-foreground">Mục tiêu mỗi ngày — để trống thì app tự gợi ý theo cân nặng, chiều cao, tuổi (cùng công thức với nút gợi ý calo).</p>
      {calc && <CalorieSuggest ctx={calc} onApply={(t) => onChange({ ...f, ...t })} />}
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Calo (kcal)" htmlFor="am-kcal"><Input id="am-kcal" inputMode="numeric" value={f.kcal} onChange={num('kcal')} /></Field>
        <Field label="Đạm (g)" htmlFor="am-p"><Input id="am-p" inputMode="numeric" value={f.protein} onChange={num('protein')} /></Field>
        <Field label="Tinh bột (g)" htmlFor="am-c"><Input id="am-c" inputMode="numeric" value={f.carb} onChange={num('carb')} /></Field>
        <Field label="Béo (g)" htmlFor="am-f"><Input id="am-f" inputMode="numeric" value={f.fat} onChange={num('fat')} /></Field>
      </div>
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Món thích (tuỳ chọn)" htmlFor="am-like"><Input id="am-like" placeholder="cá, bún, khoai lang…" value={f.likes} onChange={(e) => set('likes', e.target.value)} /></Field>
        <Field label="Không ăn / dị ứng" htmlFor="am-dislike"><Input id="am-dislike" placeholder="hải sản, sữa…" value={f.dislikes} onChange={(e) => set('dislikes', e.target.value)} /></Field>
      </div>
    </div>
  )
}
