'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowDown, ArrowUp, CalendarDays, Check, Copy, MoreHorizontal, Pencil, Plus, Printer, Search, Share2, Trash2, TriangleAlert, UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field } from '@/components/form/Field'
import { Pager, usePaged } from '@/components/ui/pagination'
import { confirmDialog, promptDialog } from '@/components/ui/app-dialog'
import { ProgressBar } from './ProgressBar'
import { exerciseLine } from './format'
import { HEALTH_FLAG_LABEL } from '@/lib/labels'
import { formatDate, formatDateTime } from '@/lib/date'
import { cleanDecimalInput, fmtNum } from '@/lib/num'
import { normVi } from '@/components/exercises/Library'
import type { PlanData, PlanExercise, PlanSession } from '@/lib/plans'
import * as A from '@/app/(app)/giao-an/actions'

export type Member = { id: string; full_name: string; health_flags: string[] }
type Lib = { id: string; name: string; muscle_group: string | null; equipment: string | null; contraindications: string[] }
type Res = { ok: boolean; error?: string }

export function PlanEditor({ plan, context, members, library, isGroup }: {
  plan: PlanData; context: string; members: Member[]; library: Lib[]; isGroup: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const weeks = useMemo(() => [...new Set(plan.sessions.map((s) => s.week))].sort((a, b) => a - b), [plan.sessions])
  const [week, setWeek] = useState(weeks[0] ?? 1)
  const shownWeek = weeks.includes(week) ? week : weeks[0] ?? 1
  const sessions = plan.sessions.filter((s) => s.week === shownWeek)
  const done = plan.sessions.filter((s) => s.completed_at).length
  const [picker, setPicker] = useState<{ sessionId: string; clientId?: string; replacesId?: string } | null>(null)
  const [editing, setEditing] = useState<PlanExercise | null>(null)
  const [completing, setCompleting] = useState<PlanSession | null>(null)
  const memberName = new Map(members.map((m) => [m.id, m.full_name]))

  const act = (p: Promise<Res>, ok?: string, after?: () => void) => start(async () => {
    const r = await p
    if (r.ok) { if (ok) toast.success(ok); after?.() } else toast.error(r.error)
  })

  return (
    <div className="pb-6">
      {/* Đầu trang */}
      <div className="mb-4">
        <p className="label-caps">{context}</p>
        <div className="mt-1 flex items-start gap-2">
          <h1 className="flex-1 text-2xl font-bold leading-tight">{plan.name}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Tuỳ chọn" className="no-print"><MoreHorizontal /></Button>} />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={async () => {
                const n = await promptDialog({ title: 'Đổi tên giáo án', label: 'Tên giáo án', defaultValue: plan.name, required: true })
                if (n) act(A.renamePlan(plan.id, n), 'Đã đổi tên.')
              }}><Pencil /> Đổi tên</DropdownMenuItem>
              {!plan.is_template && <DropdownMenuItem onClick={async () => {
                const n = await promptDialog({ title: 'Lưu thành mẫu giáo án', description: 'Mẫu giữ nguyên các tuần, buổi và bài để nhân bản cho khách khác.', label: 'Tên mẫu', defaultValue: plan.name, required: true, confirmLabel: 'Lưu mẫu' })
                if (n) act(A.saveAsTemplate(plan.id, n), 'Đã lưu thành mẫu — dùng lại khi tạo giáo án mới.')
              }}><Copy /> Lưu thành mẫu</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => window.print()}><Printer /> In / Xuất PDF</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={async () => {
                if (await confirmDialog({ title: `Xoá giáo án "${plan.name}"?`, description: 'Mọi buổi tập, bài tập và kết quả đã ghi sẽ bị xoá.', destructive: true })) act(A.deletePlan(plan.id), 'Đã xoá giáo án.', () => router.back())
              }}><Trash2 /> Xoá giáo án</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!plan.is_template && (
          <>
            <ProgressBar done={done} total={plan.sessions.length} className="mt-3" />
            <div className="no-print mt-3 flex flex-wrap items-center gap-2">
              {plan.shared_at ? (
                <>
                  <Badge className="bg-success/15 text-success"><Check /> Đã chia sẻ {formatDateTime(plan.shared_at)}</Badge>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(A.sharePlan(plan.id, false), 'Đã ẩn khỏi khách.')}>Ngừng chia sẻ</Button>
                </>
              ) : (
                <Button disabled={pending} onClick={() => act(A.sharePlan(plan.id, true), isGroup ? 'Đã chia sẻ — các khách trong nhóm thấy ngay khi đăng nhập.' : 'Đã chia sẻ — khách thấy ngay khi đăng nhập app.')}>
                  <Share2 /> Chia sẻ cho {isGroup ? 'nhóm' : 'khách'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tuần */}
      <div className="no-print -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {weeks.map((w) => (
          <button key={w} type="button" onClick={() => setWeek(w)} aria-pressed={w === shownWeek}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${w === shownWeek ? 'border-brand bg-brand/15' : 'border-border text-muted-foreground'}`}>
            Tuần {w}
          </button>
        ))}
        <Button variant="outline" disabled={pending} onClick={() => act(A.duplicateWeek(plan.id, shownWeek), 'Đã nhân bản thành tuần mới.', () => setWeek(Math.max(...weeks) + 1))}>
          <Copy /> Nhân bản tuần {shownWeek}
        </Button>
      </div>

      <div className="space-y-4">
        {sessions.map((s) => (
          <SessionCard key={s.id} s={s} isTemplate={plan.is_template} isGroup={isGroup} members={members} memberName={memberName} pending={pending}
            onAdd={() => setPicker({ sessionId: s.id })} onEdit={setEditing} onComplete={() => setCompleting(s)} act={act} />
        ))}
      </div>

      <div className="no-print mt-4 flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => act(A.addSession(plan.id, shownWeek))}><Plus /> Thêm buổi vào tuần {shownWeek}</Button>
        {weeks.length > 1 && <Button variant="ghost" disabled={pending} onClick={async () => { if (await confirmDialog({ title: `Xoá toàn bộ tuần ${shownWeek}?`, description: 'Mọi buổi và bài tập trong tuần này sẽ bị xoá.', destructive: true })) act(A.deleteWeek(plan.id, shownWeek)) }}><Trash2 /> Xoá tuần {shownWeek}</Button>}
      </div>

      {picker && <ExercisePicker library={library} members={picker.clientId ? members.filter((m) => m.id === picker.clientId) : members}
        onClose={() => setPicker(null)}
        onPick={(exId) => act(A.addSessionExercise(picker.sessionId, exId, { clientId: picker.clientId, replacesId: picker.replacesId }), 'Đã thêm bài.', () => setPicker(null))} />}
      {editing && <ExerciseEditor key={editing.id} ex={editing} isGroup={isGroup} members={members} pending={pending} act={act}
        onClose={() => setEditing(null)}
        onPersonal={(clientId) => { setPicker({ sessionId: editing.session_id, clientId, replacesId: editing.id }); setEditing(null) }} />}
      {completing && <CompleteDialog key={completing.id} s={completing} pending={pending} act={act} onClose={() => setCompleting(null)} />}
    </div>
  )
}

// ─── Một buổi tập ───────────────────────────────────────────────────────────
function SessionCard({ s, isTemplate, isGroup, members, memberName, pending, onAdd, onEdit, onComplete, act }: {
  s: PlanSession; isTemplate: boolean; isGroup: boolean; members: Member[]; memberName: Map<string, string>; pending: boolean
  onAdd: () => void; onEdit: (e: PlanExercise) => void; onComplete: () => void; act: (p: Promise<Res>, ok?: string) => void
}) {
  const base = s.exercises.filter((e) => !e.client_id)
  const personal = s.exercises.filter((e) => e.client_id)
  const att = new Map(s.attendance.map((a) => [a.client_id, a.present]))

  return (
    <section className={`break-inside-avoid rounded-xl border bg-card p-4 ${s.completed_at ? 'border-success/40' : 'border-border'}`}>
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{s.title || `Buổi ${s.day_order}`} {s.is_self_training && <Badge variant="outline" className="ml-1">Tự tập</Badge>}</p>
          <p className="text-xs text-muted-foreground">
            Tuần {s.week} · Buổi {s.day_order}{s.scheduled_date && ` · ${formatDate(s.scheduled_date)}`}
            {s.completed_at && <span className="text-success"> · Đã xong {formatDate(s.completed_at)}</span>}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Tuỳ chọn buổi" className="no-print"><MoreHorizontal /></Button>} />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={async () => {
              const t = await promptDialog({ title: 'Đổi tên buổi', label: 'Tên buổi', defaultValue: s.title ?? '' })
              if (t !== null) act(A.updateSession(s.id, { title: t }))
            }}><Pencil /> Đổi tên buổi</DropdownMenuItem>
            {!isTemplate && <DropdownMenuItem onClick={async () => {
              const d = await promptDialog({ title: 'Ngày dự kiến', description: 'Buổi có ngày dự kiến hôm nay sẽ hiện ở mục "Khách hôm nay". Để trống để bỏ ngày.', label: 'Ngày', type: 'date', defaultValue: s.scheduled_date ?? '' })
              if (d !== null) act(A.updateSession(s.id, { scheduled_date: d || null }))
            }}><CalendarDays /> Đặt ngày dự kiến</DropdownMenuItem>}
            {!isGroup && <DropdownMenuItem onClick={() => act(A.updateSession(s.id, { is_self_training: !s.is_self_training }))}>{s.is_self_training ? 'Bỏ đánh dấu tự tập' : 'Đánh dấu là buổi khách tự tập'}</DropdownMenuItem>}
            <DropdownMenuItem variant="destructive" onClick={async () => {
              if (await confirmDialog({ title: `Xoá ${s.title || `buổi ${s.day_order}`}?`, description: 'Các bài tập và kết quả đã ghi của buổi này sẽ bị xoá.', destructive: true })) act(A.deleteSession(s.id))
            }}><Trash2 /> Xoá buổi</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ol className="space-y-2">
        {base.map((e, i) => (
          <li key={e.id}>
            <ExerciseRow e={e} index={i + 1} onClick={() => onEdit(e)} />
            {personal.filter((p) => p.replaces_id === e.id).map((p) => (
              <button key={p.id} type="button" onClick={() => onEdit(p)} className="ml-6 mt-1 flex w-[calc(100%-1.5rem)] items-start gap-2 rounded-lg border border-dashed border-border p-2 text-left text-sm">
                <UserRound className="mt-0.5 size-4 shrink-0 text-brand" />
                <span><b>Riêng {memberName.get(p.client_id!)}:</b> {p.exercise.name} — <span className="text-muted-foreground">{exerciseLine(p)}</span></span>
              </button>
            ))}
            <div className="no-print ml-6 flex gap-1">
              <Button size="icon-sm" variant="ghost" aria-label="Lên" disabled={i === 0 || pending} onClick={() => act(A.moveSessionExercise(s.id, e.id, -1))}><ArrowUp /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Xuống" disabled={i === base.length - 1 || pending} onClick={() => act(A.moveSessionExercise(s.id, e.id, 1))}><ArrowDown /></Button>
            </div>
          </li>
        ))}
        {base.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bài tập.</p>}
      </ol>

      {s.comment && <p className="mt-3 rounded-lg bg-secondary p-2 text-sm"><b>Nhận xét:</b> {s.comment}</p>}

      {isGroup && !isTemplate && (
        <div className="mt-3 space-y-1 rounded-lg bg-secondary p-3">
          <p className="label-caps mb-1">Điểm danh</p>
          {members.map((m) => {
            const v = att.get(m.id)
            return (
              <div key={m.id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm">{m.full_name}</span>
                <Button size="sm" variant={v === true ? 'default' : 'outline'} disabled={pending} onClick={() => act(A.setAttendance(s.id, m.id, v === true ? null : true))}>Có mặt</Button>
                <Button size="sm" variant={v === false ? 'secondary' : 'outline'} disabled={pending} onClick={() => act(A.setAttendance(s.id, m.id, v === false ? null : false))}>Vắng</Button>
              </div>
            )
          })}
        </div>
      )}

      <div className="no-print mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onAdd}><Plus /> Thêm bài</Button>
        {!isTemplate && (
          <Button variant={s.completed_at ? 'secondary' : 'default'} onClick={onComplete}>
            <Check /> {s.completed_at ? 'Sửa kết quả' : 'Hoàn thành'}
          </Button>
        )}
      </div>
    </section>
  )
}

function ExerciseRow({ e, index, onClick }: { e: PlanExercise; index: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-secondary">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">{index}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{e.exercise.name}</span>
        <span className="block text-sm text-muted-foreground">{exerciseLine(e)}</span>
        {e.notes && <span className="block text-xs text-muted-foreground">↳ {e.notes}</span>}
        {e.actual_weight_kg !== null && <span className="block text-xs text-success">Tạ thực tế: {fmtNum(Number(e.actual_weight_kg))} kg</span>}
      </span>
    </button>
  )
}

// ─── Chọn bài từ thư viện + cảnh báo chống chỉ định ─────────────────────────
function ExercisePicker({ library, members, onPick, onClose }: { library: Lib[]; members: Member[]; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [warn, setWarn] = useState<{ ex: Lib; hits: { member: string; flags: string[] }[] } | null>(null)
  const list = library.filter((e) => !q || normVi(e.name).includes(normVi(q)) || normVi(e.muscle_group ?? '').includes(normVi(q)))
  const paged = usePaged(list, 20, q)

  function choose(ex: Lib) {
    const hits = members.map((m) => ({ member: m.full_name, flags: ex.contraindications.filter((c) => m.health_flags.includes(c)) })).filter((h) => h.flags.length)
    if (hits.length) setWarn({ ex, hits }); else onPick(ex.id)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {warn ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-warning"><TriangleAlert /> Cảnh báo chống chỉ định</DialogTitle>
              <DialogDescription>
                <b className="text-foreground">{warn.ex.name}</b> có chống chỉ định trùng với tiền sử của:
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              {warn.hits.map((h) => <li key={h.member}><b>{h.member}</b>: {h.flags.map((f) => HEALTH_FLAG_LABEL[f] ?? f).join(', ')}</li>)}
            </ul>
            <p className="text-sm text-muted-foreground">Nên chọn bài thay thế. Chỉ thêm nếu đã có chỉ định chuyên môn phù hợp.</p>
            <DialogFooter className="gap-2">
              <Button variant="secondary" onClick={() => setWarn(null)}>Chọn bài khác</Button>
              <Button variant="destructive" onClick={() => onPick(warn.ex.id)}>Vẫn thêm</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Chọn bài tập</DialogTitle></DialogHeader>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus className="pl-9" placeholder="Tìm theo tên hoặc nhóm cơ" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="max-h-[55dvh] space-y-1 overflow-y-auto">
              {paged.pageItems.map((e) => {
                const risky = members.some((m) => e.contraindications.some((c) => m.health_flags.includes(c)))
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => choose(e)} className="flex min-h-12 w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-secondary">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[e.muscle_group, e.equipment].filter(Boolean).join(' · ')}</span>
                      </span>
                      {risky && <TriangleAlert className="size-4 shrink-0 text-warning" aria-label="Có chống chỉ định" />}
                    </button>
                  </li>
                )
              })}
            </ul>
            {list.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Không tìm thấy bài phù hợp.</p>}
            <Pager paged={paged} label="bài" className="mt-0" />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Sửa thông số một bài ───────────────────────────────────────────────────
function ExerciseEditor({ ex, isGroup, members, pending, act, onClose, onPersonal }: {
  ex: PlanExercise; isGroup: boolean; members: Member[]; pending: boolean
  act: (p: Promise<Res>, ok?: string, after?: () => void) => void; onClose: () => void; onPersonal: (clientId: string) => void
}) {
  const s = (v: number | string | null) => (v === null ? '' : String(v).replace('.', ','))
  const [f, setF] = useState({ sets: s(ex.sets), reps: ex.reps ?? '', duration_sec: s(ex.duration_sec), weight_kg: s(ex.weight_kg), rest_sec: s(ex.rest_sec), notes: ex.notes ?? '' })
  const [member, setMember] = useState(members[0]?.id ?? '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); act(A.updateSessionExercise(ex.id, f), 'Đã lưu.', onClose) }}>
          <DialogHeader><DialogTitle>{ex.exercise.name}</DialogTitle>{ex.client_id && <DialogDescription>Bài chỉnh riêng cho một khách trong nhóm.</DialogDescription>}</DialogHeader>
          <div className="grid grid-cols-3 items-end gap-3">
            <Field label="Số hiệp" htmlFor="e-sets"><Input id="e-sets" inputMode="numeric" value={f.sets} onChange={(e) => setF({ ...f, sets: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label="Lần lặp" htmlFor="e-reps"><Input id="e-reps" placeholder="10 / 8-12" value={f.reps} onChange={(e) => setF({ ...f, reps: e.target.value })} /></Field>
            <Field label="Thời gian (giây)" htmlFor="e-dur"><Input id="e-dur" inputMode="numeric" value={f.duration_sec} onChange={(e) => setF({ ...f, duration_sec: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label="Mức tạ (kg)" htmlFor="e-kg"><Input id="e-kg" inputMode="decimal" value={f.weight_kg} onChange={(e) => setF({ ...f, weight_kg: cleanDecimalInput(e.target.value) })} /></Field>
            <Field label="Nghỉ (giây)" htmlFor="e-rest"><Input id="e-rest" inputMode="numeric" value={f.rest_sec} onChange={(e) => setF({ ...f, rest_sec: e.target.value.replace(/\D/g, '') })} /></Field>
          </div>
          <Field label="Ghi chú kỹ thuật" htmlFor="e-notes"><Textarea id="e-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          {isGroup && !ex.client_id && members.length > 0 && (
            <div className="space-y-2 rounded-lg bg-secondary p-3">
              <p className="text-sm font-semibold">Chỉnh riêng cho một người</p>
              <p className="text-xs text-muted-foreground">Thêm bài thay thế hoặc mức tạ riêng; người khác vẫn tập bài chung.</p>
              <div className="flex gap-2">
                <NativeSelect className="flex-1" value={member} onChange={(e) => setMember(e.target.value)} aria-label="Khách">
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </NativeSelect>
                <Button type="button" variant="outline" onClick={() => onPersonal(member)}>Chọn bài riêng</Button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="destructive" disabled={pending} onClick={async () => { if (await confirmDialog({ title: `Xoá "${ex.exercise.name}" khỏi buổi?`, destructive: true })) act(A.deleteSessionExercise(ex.id), 'Đã xoá.', onClose) }}><Trash2 /> Xoá</Button>
            <Button type="submit" disabled={pending}>Lưu</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Hoàn thành buổi: tạ thực tế + nhận xét ─────────────────────────────────
function CompleteDialog({ s, pending, act, onClose }: { s: PlanSession; pending: boolean; act: (p: Promise<Res>, ok?: string, after?: () => void) => void; onClose: () => void }) {
  const [comment, setComment] = useState(s.comment ?? '')
  const [actual, setActual] = useState<Record<string, string>>(Object.fromEntries(s.exercises.map((e) => [e.id, e.actual_weight_kg !== null ? String(e.actual_weight_kg).replace('.', ',') : ''])))
  const [done, setDone] = useState(true)
  const save = () => act(A.completeSession(s.id, { done, comment, actuals: Object.entries(actual).map(([id, v]) => ({ id, actual_weight_kg: v })) }),
    done ? 'Đã hoàn thành buổi.' : 'Đã lưu.', onClose)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Kết quả {s.title || `buổi ${s.day_order}`}</DialogTitle><DialogDescription>Ghi mức tạ thực tế (nếu khác giáo án) và nhận xét sau buổi.</DialogDescription></DialogHeader>
        <ul className="space-y-2">
          {s.exercises.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-sm">{e.exercise.name}<span className="block text-xs text-muted-foreground">{exerciseLine(e)}</span></span>
              <Input className="w-24" inputMode="decimal" placeholder="kg" aria-label={`Tạ thực tế ${e.exercise.name}`} value={actual[e.id] ?? ''}
                onChange={(ev) => setActual({ ...actual, [e.id]: cleanDecimalInput(ev.target.value) })} />
            </li>
          ))}
        </ul>
        <Field label="Nhận xét sau buổi" htmlFor="c-comment"><Textarea id="c-comment" value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
        {s.completed_at && (
          <label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox checked={done} onCheckedChange={(v) => setDone(v === true)} /> Buổi đã hoàn thành (bỏ chọn để huỷ — gói tập được hoàn lại 1 buổi)</label>
        )}
        <DialogFooter><Button disabled={pending} onClick={save}><Check /> {s.completed_at ? 'Lưu' : 'Đánh dấu hoàn thành'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
