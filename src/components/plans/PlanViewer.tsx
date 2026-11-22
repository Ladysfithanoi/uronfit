'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, Printer, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExerciseDetail } from '@/components/exercises/ExerciseDetail'
import { ProgressBar } from './ProgressBar'
import { Pager, usePaged, useScrollTop } from '@/components/ui/pagination'
import { exerciseLine } from './format'
import { formatDate } from '@/lib/date'
import type { PlanExercise, PlanSession } from '@/lib/plans'
import { completeSelfSession } from '@/app/(app)/giao-an/actions'
import { cn } from '@/lib/utils'

/** Bài khách thực sự tập: dòng chỉnh riêng cho mình thay cho dòng chung */
function myExercises(s: PlanSession, clientId: string) {
  const mine = s.exercises.filter((e) => e.client_id === clientId)
  return s.exercises
    .filter((e) => !e.client_id)
    .flatMap((e) => { const o = mine.find((m) => m.replaces_id === e.id); return [o ?? e] })
}

export function PlanViewer({ clientId, name, subtitle, sessions, isGroup, canSelfTrack = true, canPrint = true }: {
  clientId: string; name: string; subtitle: string; sessions: PlanSession[]; isGroup: boolean
  /** Theo gói dịch vụ của khách */ canSelfTrack?: boolean; canPrint?: boolean
}) {
  const [open, setOpen] = useState<string | null>(sessions.find((s) => !s.completed_at)?.id ?? null)
  const [view, setView] = useState<PlanExercise | null>(null)
  const [pending, start] = useTransition()
  const isDone = (s: PlanSession) => !!s.completed_at || s.attendance.some((a) => a.client_id === clientId && a.present)
  const done = sessions.filter(isDone).length
  const weeks = [...new Set(sessions.map((s) => s.week))].sort((a, b) => a - b)
  // 4 tuần / trang; mở sẵn trang có buổi chưa tập đầu tiên
  const nextWeek = sessions.find((s) => !isDone(s))?.week ?? weeks[0]
  const paged = usePaged(weeks, 4, '', Math.floor(Math.max(0, weeks.indexOf(nextWeek)) / 4) + 1)
  const { ref: topRef, scroll } = useScrollTop<HTMLDivElement>()

  return (
    <section>
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1"><p className="label-caps">{subtitle}</p><h2 className="text-xl font-bold">{name}</h2></div>
        {canPrint && <Button variant="ghost" size="icon" className="no-print" aria-label="In / Xuất PDF" onClick={() => window.print()}><Printer /></Button>}
      </div>
      <ProgressBar done={done} total={sessions.length} className="mb-4" />
      <div ref={topRef} className="scroll-mt-20" />
      {/* Màn hình: chỉ trang đang xem; bản in: đủ mọi tuần */}
      {weeks.map((w) => (
        <div key={w} className={cn('mb-4', !paged.pageItems.includes(w) && 'hidden print:block')}>
          <p className="label-caps mb-2">Tuần {w}</p>
          <ul className="space-y-2">
            {sessions.filter((s) => s.week === w).map((s) => {
              const exs = myExercises(s, clientId)
              const expanded = open === s.id
              return (
                <li key={s.id} className={cn('break-inside-avoid rounded-xl border bg-card', isDone(s) ? 'border-success/40' : 'border-border')}>
                  <button type="button" onClick={() => setOpen(expanded ? null : s.id)} aria-expanded={expanded}
                    className="flex min-h-14 w-full items-center gap-3 p-4 text-left">
                    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border', isDone(s) ? 'border-success bg-success text-black' : 'border-border')}>
                      {isDone(s) && <Check className="size-4" />}
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{s.title || `Buổi ${s.day_order}`} {s.is_self_training && <Badge variant="outline" className="ml-1">Tự tập</Badge>}</span>
                      <span className="block text-xs text-muted-foreground">{exs.length} bài{s.scheduled_date && ` · ${formatDate(s.scheduled_date)}`}{s.completed_at && ` · xong ${formatDate(s.completed_at)}`}</span>
                    </span>
                    <ChevronDown className={cn('size-5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                  </button>
                  <div className={cn('border-t border-border px-4 pb-4', !expanded && 'hidden print:block')}>
                    <ol className="mt-2 space-y-1">
                      {exs.map((e, i) => (
                        <li key={e.id}>
                          <button type="button" onClick={() => setView(e)} className="flex min-h-12 w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-secondary">
                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">{i + 1}</span>
                            <span className="flex-1">
                              <span className="block font-medium">{e.exercise.name} {e.client_id && <Badge variant="outline" className="ml-1">Riêng bạn</Badge>}</span>
                              <span className="block text-sm text-muted-foreground">{exerciseLine(e)}</span>
                              {e.notes && <span className="block text-xs text-muted-foreground">↳ {e.notes}</span>}
                            </span>
                            {(e.exercise.video_url || e.exercise.image_url) && <Video className="mt-1 size-4 shrink-0 text-brand" aria-label="Có hướng dẫn" />}
                          </button>
                        </li>
                      ))}
                    </ol>
                    {s.comment && <p className="mt-2 rounded-lg bg-secondary p-2 text-sm"><b>HLV nhận xét:</b> {s.comment}</p>}
                    {s.is_self_training && !isGroup && canSelfTrack && (
                      <Button className="no-print mt-3 w-full" variant={s.completed_at ? 'secondary' : 'default'} disabled={pending}
                        onClick={() => start(async () => {
                          const r = await completeSelfSession(s.id, !s.completed_at)
                          if (r.ok) toast.success(s.completed_at ? 'Đã bỏ đánh dấu.' : 'Tuyệt vời! Đã hoàn thành buổi tự tập.'); else toast.error(r.error)
                        })}>
                        <Check /> {s.completed_at ? 'Bỏ đánh dấu hoàn thành' : 'Tôi đã tập xong buổi này'}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <Pager paged={paged} label="tuần" onChange={scroll} />

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle>{view.exercise.name}</DialogTitle></DialogHeader>
              <p className="text-sm font-semibold text-brand">{exerciseLine(view)}</p>
              {view.notes && <p className="text-sm">↳ {view.notes}</p>}
              <ExerciseDetail ex={view.exercise} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
