'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Copy, MoreHorizontal, Pencil, Plus, Printer, Share2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field } from '@/components/form/Field'
import { confirmDialog, promptDialog } from '@/components/ui/app-dialog'
import { MacroTargets, DayMeals } from './MealView'
import { CalorieSuggest } from './CalorieSuggest'
import type { CalcContext } from '@/lib/nutrition'
import { formatDateTime } from '@/lib/date'
import { MEAL_SLOTS, type Meal, type MealPlan } from '@/lib/meals'
import * as A from '@/app/(app)/thuc-don/actions'

type Res = { ok: boolean; error?: string }

export function MealEditor({ plan, meals, context, calc }: { plan: MealPlan; meals: Meal[]; context: string; calc?: CalcContext | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const days = useMemo(() => { const d = [...new Set(meals.map((m) => m.day_number))].sort((a, b) => a - b); return d.length ? d : [1] }, [meals])
  const [day, setDay] = useState(days[0])
  const shown = days.includes(day) ? day : days[0]
  const [mealEdit, setMealEdit] = useState<{ id?: string; form: A.MealInput } | null>(null)
  const [targets, setTargets] = useState<null | { name: string; kcal: string; protein: string; carb: string; fat: string }>(null)
  const act = (p: Promise<Res>, ok?: string, after?: () => void) => start(async () => { const r = await p; if (r.ok) { if (ok) toast.success(ok); after?.() } else toast.error(r.error) })
  const s = (n: number | null) => (n === null ? '' : String(n))

  return (
    <div className="pb-6">
      <p className="label-caps">{context}</p>
      <div className="mt-1 flex items-start gap-2">
        <h1 className="flex-1 text-2xl font-bold leading-tight">{plan.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Tuỳ chọn" className="no-print"><MoreHorizontal /></Button>} />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTargets({ name: plan.name, kcal: s(plan.kcal), protein: s(plan.protein_g), carb: s(plan.carb_g), fat: s(plan.fat_g) })}><Pencil /> Sửa tên & mục tiêu</DropdownMenuItem>
            {!plan.is_template && <DropdownMenuItem onClick={async () => {
              const n = await promptDialog({ title: 'Lưu thành mẫu thực đơn', description: 'Mẫu dùng lại được cho khách khác.', label: 'Tên mẫu', defaultValue: plan.name, required: true, confirmLabel: 'Lưu mẫu' })
              if (n) act(A.saveMealAsTemplate(plan.id, n), 'Đã lưu thành mẫu.')
            }}><Copy /> Lưu thành mẫu</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => window.print()}><Printer /> In / Xuất PDF</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={async () => {
              if (await confirmDialog({ title: `Xoá thực đơn "${plan.name}"?`, description: 'Toàn bộ các ngày và món ăn sẽ bị xoá.', destructive: true })) act(A.deleteMealPlan(plan.id), 'Đã xoá.', () => router.back())
            }}><Trash2 /> Xoá thực đơn</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <MacroTargets plan={plan} className="mt-3" />

      {!plan.is_template && (
        <div className="no-print mt-3 flex flex-wrap items-center gap-2">
          {plan.shared_at ? (
            <>
              <Badge className="bg-success/15 text-success"><Check /> Đã chia sẻ {formatDateTime(plan.shared_at)}</Badge>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(A.shareMealPlan(plan.id, false), 'Đã ẩn khỏi khách.')}>Ngừng chia sẻ</Button>
            </>
          ) : <Button disabled={pending} onClick={() => act(A.shareMealPlan(plan.id, true), 'Đã chia sẻ — khách thấy ngay khi đăng nhập app.')}><Share2 /> Chia sẻ cho khách</Button>}
        </div>
      )}

      <div className="no-print -mx-4 my-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {days.map((d) => (
          <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={d === shown}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${d === shown ? 'border-brand bg-brand/15' : 'border-border text-muted-foreground'}`}>Ngày {d}</button>
        ))}
        <Button variant="outline" disabled={pending} onClick={() => act(A.duplicateDay(plan.id, shown), 'Đã nhân bản thành ngày mới.', () => setDay(Math.max(...days) + 1))}><Copy /> Nhân bản ngày {shown}</Button>
        <Button variant="ghost" onClick={() => setDay(Math.max(...days) + 1)}><Plus /> Ngày trống</Button>
      </div>

      <DayMeals meals={meals.filter((m) => m.day_number === shown)} target={plan.kcal}
        onEdit={(m) => setMealEdit({ id: m.id, form: { day_number: m.day_number, meal_slot: m.meal_slot, dish: m.dish, portion: m.portion ?? '', kcal: s(m.kcal), notes: m.notes ?? '' } })} />

      <div className="no-print mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setMealEdit({ form: { day_number: shown, meal_slot: 'Sáng', dish: '', portion: '', kcal: '', notes: '' } })}><Plus /> Thêm món ngày {shown}</Button>
        {days.length > 1 && <Button variant="ghost" disabled={pending} onClick={async () => { if (await confirmDialog({ title: `Xoá toàn bộ ngày ${shown}?`, description: 'Mọi món trong ngày này sẽ bị xoá.', destructive: true })) act(A.deleteDay(plan.id, shown)) }}><Trash2 /> Xoá ngày {shown}</Button>}
      </div>

      <Dialog open={!!mealEdit} onOpenChange={(o) => !o && setMealEdit(null)}>
        <DialogContent>
          {mealEdit && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); act(A.saveMeal(plan.id, mealEdit.form, mealEdit.id), 'Đã lưu món.', () => setMealEdit(null)) }}>
              <DialogHeader><DialogTitle>{mealEdit.id ? 'Sửa món' : `Thêm món · Ngày ${mealEdit.form.day_number}`}</DialogTitle></DialogHeader>
              <Field label="Bữa" htmlFor="m-slot">
                <NativeSelect id="m-slot" value={mealEdit.form.meal_slot} onChange={(e) => setMealEdit({ ...mealEdit, form: { ...mealEdit.form, meal_slot: e.target.value } })}>
                  {MEAL_SLOTS.map((x) => <option key={x}>{x}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Tên món" htmlFor="m-dish"><Input id="m-dish" required value={mealEdit.form.dish} onChange={(e) => setMealEdit({ ...mealEdit, form: { ...mealEdit.form, dish: e.target.value } })} /></Field>
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Khẩu phần" htmlFor="m-portion"><Input id="m-portion" placeholder="150 g / 1 bát" value={mealEdit.form.portion} onChange={(e) => setMealEdit({ ...mealEdit, form: { ...mealEdit.form, portion: e.target.value } })} /></Field>
                <Field label="Calo (kcal)" htmlFor="m-kcal"><Input id="m-kcal" inputMode="numeric" value={mealEdit.form.kcal} onChange={(e) => setMealEdit({ ...mealEdit, form: { ...mealEdit.form, kcal: e.target.value.replace(/\D/g, '') } })} /></Field>
              </div>
              <Field label="Ghi chú thay thế" htmlFor="m-notes" hint="Ví dụ: có thể thay ức gà bằng cá basa cùng khối lượng.">
                <Textarea id="m-notes" value={mealEdit.form.notes} onChange={(e) => setMealEdit({ ...mealEdit, form: { ...mealEdit.form, notes: e.target.value } })} />
              </Field>
              <DialogFooter className="gap-2">
                {mealEdit.id && <Button type="button" variant="destructive" disabled={pending} onClick={() => act(A.deleteMeal(mealEdit.id!), 'Đã xoá món.', () => setMealEdit(null))}><Trash2 /> Xoá</Button>}
                <Button type="submit" disabled={pending}>Lưu</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!targets} onOpenChange={(o) => !o && setTargets(null)}>
        <DialogContent>
          {targets && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); act(A.updateMealPlan(plan.id, targets), 'Đã lưu.', () => setTargets(null)) }}>
              <DialogHeader><DialogTitle>Tên & mục tiêu mỗi ngày</DialogTitle></DialogHeader>
              <Field label="Tên" htmlFor="t-name"><Input id="t-name" required value={targets.name} onChange={(e) => setTargets({ ...targets, name: e.target.value })} /></Field>
              <p className="text-xs text-muted-foreground">PT nhập mục tiêu. Có thể dùng gợi ý theo công thức rồi sửa lại (khoá với trẻ em và khách phục hồi chức năng).</p>
              {calc && <CalorieSuggest ctx={calc} onApply={(t) => setTargets({ ...targets, ...t })} />}
              <div className="grid grid-cols-2 items-end gap-3">
                {([['kcal', 'Calo (kcal)'], ['protein', 'Đạm (g)'], ['carb', 'Tinh bột (g)'], ['fat', 'Béo (g)']] as const).map(([k, l]) => (
                  <Field key={k} label={l} htmlFor={`t-${k}`}><Input id={`t-${k}`} inputMode="numeric" value={targets[k]} onChange={(e) => setTargets({ ...targets, [k]: e.target.value.replace(/\D/g, '') })} /></Field>
                ))}
              </div>
              <DialogFooter><Button type="submit" disabled={pending}>Lưu</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
