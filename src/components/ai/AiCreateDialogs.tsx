'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AiMealFields, AiWorkoutFields, defaultMeal, defaultWorkout, type MealForm, type WorkoutForm } from './AiFields'
import { aiCreateMealPlan, aiCreateWorkoutPlan } from '@/app/actions/ai'
import type { CalcContext } from '@/lib/nutrition'

/** Nút "Tạo bằng AI" trong tab Giáo án của hồ sơ khách */
export function AiWorkoutButton({ clientId, phaseId }: { clientId: string; phaseId?: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<WorkoutForm>(defaultWorkout)
  const [pending, start] = useTransition()
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Sparkles /> Tạo bằng AI</Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo lịch tập bằng AI</DialogTitle>
            <DialogDescription>AI chỉ chọn bài trong Thư viện; bài chống chỉ định với tiền sử của khách bị loại trước. Giáo án tạo ra chưa chia sẻ — PT xem lại rồi mới Chia sẻ.</DialogDescription>
          </DialogHeader>
          <AiWorkoutFields value={f} onChange={setF} />
          <DialogFooter className="gap-2">
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Huỷ</Button>
            <Button disabled={pending} onClick={() => start(async () => {
              const r = await aiCreateWorkoutPlan(clientId, f, phaseId)
              if (!r.ok) { toast.error(r.error); return }
              toast.success(r.data!.usedAi ? `AI đã tạo ${r.data!.sessions} buổi tập.` : `Đã dựng ${r.data!.sessions} buổi theo quy tắc (AI tạm không khả dụng).`)
              setOpen(false); router.push(`/giao-an/${r.data!.id}`)
            })}><Sparkles /> {pending ? 'AI đang soạn… (≈20–40 giây)' : 'Tạo lịch tập'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Nút "Tạo bằng AI" trong tab Thực đơn của hồ sơ khách */
export function AiMealButton({ clientId, phaseId, calc }: { clientId: string; phaseId?: string | null; calc: CalcContext | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<MealForm>(defaultMeal)
  const [pending, start] = useTransition()
  if (calc?.blocked) {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3.5" /> AI thực đơn khoá với khách này</span>
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Sparkles /> Tạo bằng AI</Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo thực đơn bằng AI</DialogTitle>
            <DialogDescription>AI chọn món từ CSDL thực phẩm Việt Nam, app tự tính khẩu phần cho khớp mục tiêu (giống app diet-plan). Thực đơn tạo ra chưa chia sẻ.</DialogDescription>
          </DialogHeader>
          <AiMealFields value={f} onChange={setF} calc={calc} />
          <DialogFooter className="gap-2">
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Huỷ</Button>
            <Button disabled={pending} onClick={() => start(async () => {
              const r = await aiCreateMealPlan(clientId, f, phaseId)
              if (!r.ok) { toast.error(r.error); return }
              toast.success(`Đã tạo thực đơn ${r.data!.days} ngày · ${r.data!.kcal} kcal${r.data!.usedAi ? '' : ' (dùng thực đơn dự phòng — AI tạm không khả dụng)'}.`)
              setOpen(false); router.push(`/thuc-don/${r.data!.id}`)
            })}><Sparkles /> {pending ? 'Đang tạo… (≈10–30 giây)' : 'Tạo thực đơn'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
