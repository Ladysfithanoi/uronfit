'use client'

import { useMemo, useState } from 'react'
import { Calculator, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, ChipGroup } from '@/components/form/Field'
import { cleanDecimalInput, fmtNum, parseDecimal } from '@/lib/num'
import {
  FORMULA_LABEL, GYM_LEVELS, LOSS_SPEEDS, STEP_LEVELS, suggest,
  type BmrFormula, type CalcContext, type WeightGoal,
} from '@/lib/nutrition'

export type Targets = { kcal: string; protein: string; carb: string; fat: string }

/** Nút "Tính gợi ý" + hộp tính BMR / TDEE / calo mục tiêu / macro. PT quyết định có dùng hay không. */
export function CalorieSuggest({ ctx, onApply }: { ctx: CalcContext; onApply: (t: Targets) => void }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    kg: ctx.kg != null ? String(ctx.kg).replace('.', ',') : '', cm: ctx.cm != null ? String(ctx.cm) : '',
    age: ctx.age != null ? String(ctx.age) : '', male: ctx.male,
    formula: 'mifflin' as BmrFormula, step: 1, gym: 1, goal: ctx.defaultGoal as WeightGoal, loss: 0,
  })
  const kg = parseDecimal(f.kg), cm = parseDecimal(f.cm), age = parseDecimal(f.age)
  const ready = !!kg && !!cm && !!age && kg > 20 && cm > 100 && age >= 16
  const r = useMemo(() => ready ? suggest({
    formula: f.formula, male: f.male, kg: kg!, cm: cm!, age: age!, step: f.step, gym: f.gym, goal: f.goal, lossRate: LOSS_SPEEDS[f.loss].rate,
  }) : null, [ready, f, kg, cm, age])

  if (ctx.blocked) {
    return <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary p-3 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5 shrink-0" />{ctx.blocked}</p>
  }

  return (
    <>
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}><Calculator /> Tính gợi ý calo & macro</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gợi ý calo & macro</DialogTitle>
            <DialogDescription>Chỉ là gợi ý theo công thức cho người lớn khoẻ mạnh. PT xem xét và có thể sửa sau khi áp dụng.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 items-end gap-3">
              <Field label="Cân (kg)" htmlFor="cs-kg"><Input id="cs-kg" inputMode="decimal" value={f.kg} onChange={(e) => setF({ ...f, kg: cleanDecimalInput(e.target.value) })} /></Field>
              <Field label="Cao (cm)" htmlFor="cs-cm"><Input id="cs-cm" inputMode="decimal" value={f.cm} onChange={(e) => setF({ ...f, cm: cleanDecimalInput(e.target.value) })} /></Field>
              <Field label="Tuổi" htmlFor="cs-age"><Input id="cs-age" inputMode="numeric" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value.replace(/\D/g, '') })} /></Field>
            </div>
            {(ctx.kg == null || ctx.cm == null || ctx.age == null) && (
              <p className="text-xs text-warning">Hồ sơ còn thiếu {[ctx.kg == null && 'cân nặng (nhập ở tab Chỉ số)', ctx.cm == null && 'chiều cao (Sửa hồ sơ)', ctx.age == null && 'ngày sinh'].filter(Boolean).join(', ')} — nhập tạm ở trên để tính.</p>
            )}
            <Field label="Giới tính">
              <ChipGroup options={[{ value: 'f', label: 'Nữ' }, { value: 'm', label: 'Nam' }]} value={[f.male ? 'm' : 'f']} onChange={(v) => setF({ ...f, male: v[0] === 'm' })} />
            </Field>
            <Field label="Công thức BMR" htmlFor="cs-formula">
              <NativeSelect id="cs-formula" value={f.formula} onChange={(e) => setF({ ...f, formula: e.target.value as BmrFormula })}>
                {Object.entries(FORMULA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <div className="space-y-4">
              <Field label="Vận động hằng ngày" htmlFor="cs-step">
                <NativeSelect id="cs-step" value={f.step} onChange={(e) => setF({ ...f, step: Number(e.target.value) })}>
                  {STEP_LEVELS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Tập gym" htmlFor="cs-gym">
                <NativeSelect id="cs-gym" value={f.gym} onChange={(e) => setF({ ...f, gym: Number(e.target.value) })}>
                  {GYM_LEVELS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Mục tiêu cân nặng">
              <ChipGroup options={[{ value: 'lose', label: 'Giảm' }, { value: 'maintain', label: 'Duy trì' }, { value: 'gain', label: 'Tăng' }]}
                value={[f.goal]} onChange={(v) => setF({ ...f, goal: v[0] as WeightGoal })} />
            </Field>
            {f.goal === 'lose' && (
              <Field label="Tốc độ giảm" htmlFor="cs-loss">
                <NativeSelect id="cs-loss" value={f.loss} onChange={(e) => setF({ ...f, loss: Number(e.target.value) })}>
                  {LOSS_SPEEDS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </NativeSelect>
              </Field>
            )}

            {r ? (
              <div className="space-y-2 rounded-lg border border-border bg-secondary p-3 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">BMR</p><p className="font-bold">{r.bmr}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">TDEE</p><p className="font-bold">{r.tdee}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Mục tiêu</p><p className="font-bold text-brand">{r.kcal} kcal</p></div>
                </div>
                <p className="text-center">Đạm <b>{r.protein} g</b> · Tinh bột <b>{r.carb} g</b> · Béo <b>{r.fat} g</b></p>
                {r.weekly !== null && <p className="text-center text-xs text-muted-foreground">Dự kiến {r.weekly < 0 ? 'giảm' : 'tăng'} khoảng {fmtNum(Math.abs(r.weekly), 2)} kg/tuần</p>}
                {r.belowFloor && <p className="text-xs text-warning">Calo mục tiêu thấp hơn mức tối thiểu để đủ đạm và béo — nên chọn tốc độ giảm chậm hơn.</p>}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nhập cân nặng, chiều cao và tuổi (từ 16) để xem gợi ý.</p>}
          </div>
          <DialogFooter>
            <Button type="button" disabled={!r} onClick={() => { if (r) { onApply({ kcal: String(r.kcal), protein: String(r.protein), carb: String(r.carb), fat: String(r.fat) }); setOpen(false) } }}>
              Dùng số này
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
