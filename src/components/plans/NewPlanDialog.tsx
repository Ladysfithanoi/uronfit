'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/form/Field'
import { createWorkoutPlan } from '@/app/(app)/giao-an/actions'
import { createMealPlan } from '@/app/(app)/thuc-don/actions'
import { CalorieSuggest } from '@/components/meals/CalorieSuggest'
import type { CalcContext } from '@/lib/nutrition'

type Opt = { id: string; name: string }

/** Tạo giáo án / meal plan: trống hoặc nhân bản từ mẫu */
export function NewPlanDialog({ kind, phases, defaultPhase, groupId, templates, isTemplate, label, calc }: {
  kind: 'workout' | 'meal'; phases?: Opt[]; defaultPhase?: string | null; groupId?: string
  templates: Opt[]; isTemplate?: boolean; label?: string; calc?: CalcContext | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [f, setF] = useState({ name: '', phase: defaultPhase ?? phases?.[0]?.id ?? '', template: '', weeks: '4', perWeek: '3', kcal: '', protein: '', carb: '', fat: '' })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const phaseId = isTemplate || groupId ? null : f.phase || null
      if (!isTemplate && !groupId && !phaseId) { toast.error('Hãy tạo giai đoạn trong tab Lộ trình trước.'); return }
      const r = kind === 'workout'
        ? await createWorkoutPlan({ name: f.name, phaseId, groupId: groupId ?? null, isTemplate, weeks: Number(f.weeks), perWeek: Number(f.perWeek), templateId: f.template || null })
        : await createMealPlan({ name: f.name, phaseId, isTemplate, templateId: f.template || null, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat })
      if (!r.ok) { toast.error(r.error); return }
      setOpen(false)
      router.push(kind === 'workout' ? `/giao-an/${r.data!.id}` : `/thuc-don/${r.data!.id}`)
    })
  }

  const noun = kind === 'workout' ? 'giáo án' : 'thực đơn'
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> {label ?? `Tạo ${noun}`}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form className="space-y-4" onSubmit={submit}>
            <DialogHeader><DialogTitle>{isTemplate ? `Mẫu ${noun} mới` : `Tạo ${noun}`}</DialogTitle></DialogHeader>
            <Field label="Tên" htmlFor="np-name">
              <Input id="np-name" required placeholder={kind === 'workout' ? 'Giáo án giảm mỡ 4 tuần' : 'Thực đơn 1.500 kcal'} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            {!isTemplate && !groupId && phases && (
              <Field label="Giai đoạn" htmlFor="np-phase">
                <NativeSelect id="np-phase" value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })}>
                  {phases.length === 0 && <option value="">— Chưa có giai đoạn —</option>}
                  {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            {!isTemplate && (
              <Field label="Dựa trên mẫu" htmlFor="np-tpl">
                <NativeSelect id="np-tpl" value={f.template} onChange={(e) => setF({ ...f, template: e.target.value })}>
                  <option value="">— Tạo trống —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            {!f.template && kind === 'workout' && (
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Số tuần" htmlFor="np-weeks"><Input id="np-weeks" inputMode="numeric" value={f.weeks} onChange={(e) => setF({ ...f, weeks: e.target.value.replace(/\D/g, '') })} /></Field>
                <Field label="Buổi / tuần" htmlFor="np-per"><Input id="np-per" inputMode="numeric" value={f.perWeek} onChange={(e) => setF({ ...f, perWeek: e.target.value.replace(/\D/g, '') })} /></Field>
              </div>
            )}
            {!f.template && kind === 'meal' && (
              <>
                <p className="text-xs text-muted-foreground">PT nhập mục tiêu — có thể dùng gợi ý theo công thức rồi sửa lại.</p>
                {calc && <CalorieSuggest ctx={calc} onApply={(t) => setF({ ...f, ...t })} />}
                <div className="grid grid-cols-2 items-end gap-3">
                  <Field label="Calo / ngày (kcal)" htmlFor="np-kcal"><Input id="np-kcal" inputMode="numeric" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value.replace(/\D/g, '') })} /></Field>
                  <Field label="Đạm (g)" htmlFor="np-p"><Input id="np-p" inputMode="numeric" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value.replace(/\D/g, '') })} /></Field>
                  <Field label="Tinh bột (g)" htmlFor="np-c"><Input id="np-c" inputMode="numeric" value={f.carb} onChange={(e) => setF({ ...f, carb: e.target.value.replace(/\D/g, '') })} /></Field>
                  <Field label="Béo (g)" htmlFor="np-f"><Input id="np-f" inputMode="numeric" value={f.fat} onChange={(e) => setF({ ...f, fat: e.target.value.replace(/\D/g, '') })} /></Field>
                </div>
              </>
            )}
            <DialogFooter><Button type="submit" disabled={pending}>{pending ? 'Đang tạo…' : 'Tạo'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
