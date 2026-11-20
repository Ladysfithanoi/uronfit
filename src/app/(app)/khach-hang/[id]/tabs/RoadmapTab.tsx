'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/form/Field'
import { PhaseTimeline } from '@/components/clients/PhaseTimeline'
import { confirmDialog } from '@/components/ui/app-dialog'
import { PHASE_STATUS_LABEL } from '@/lib/labels'
import { todayVN } from '@/lib/date'
import type { Phase } from '@/lib/clients'
import type { PhaseStatus } from '@/lib/types'
import { savePhase, deletePhase, movePhase, type PhaseInput } from '../actions'

const empty = (): PhaseInput => ({ name: '', goal: '', start_date: todayVN(), end_date: null, targets: '', status: 'planned' })

export function RoadmapTab({ clientId, phases }: { clientId: string; phases: Phase[] }) {
  const [editing, setEditing] = useState<{ id?: string; form: PhaseInput } | null>(null)
  const [pending, start] = useTransition()
  const act = (p: Promise<{ ok: boolean; error?: string }>, msg?: string) => start(async () => {
    const r = await p
    if (r.ok) { if (msg) toast.success(msg) } else toast.error(r.error)
  })

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Giáo án, meal plan và số đo đều gắn vào từng giai đoạn.</p>
        <Button onClick={() => {
          const last = phases[phases.length - 1]
          setEditing({ form: { ...empty(), name: `Giai đoạn ${phases.length + 1}`, start_date: last?.end_date ?? todayVN() } })
        }}><Plus /> Giai đoạn</Button>
      </div>

      <PhaseTimeline phases={phases} renderActions={(p, i) => (
        <div className="mt-3 flex gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Sửa" onClick={() => setEditing({ id: p.id, form: {
            name: p.name, goal: p.goal ?? '', start_date: p.start_date, end_date: p.end_date, targets: p.targets ?? '', status: p.status,
          } })}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Lên" disabled={i === 0 || pending} onClick={() => act(movePhase(clientId, p.id, -1))}><ArrowUp /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Xuống" disabled={i === phases.length - 1 || pending} onClick={() => act(movePhase(clientId, p.id, 1))}><ArrowDown /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Xoá" disabled={pending} onClick={async () => {
            if (await confirmDialog({ title: `Xoá "${p.name}"?`, description: 'Giáo án và meal plan của giai đoạn này cũng bị xoá. Số đo và ảnh vẫn được giữ lại.', destructive: true })) act(deletePhase(clientId, p.id), 'Đã xoá giai đoạn.')
          }}><Trash2 /></Button>
        </div>
      )} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const r = await savePhase(clientId, editing.form, editing.id)
                if (r.ok) { toast.success('Đã lưu giai đoạn.'); setEditing(null) } else toast.error(r.error)
              })
            }}>
              <DialogHeader><DialogTitle>{editing.id ? 'Sửa giai đoạn' : 'Thêm giai đoạn'}</DialogTitle></DialogHeader>
              <Field label="Tên" htmlFor="ph-name"><Input id="ph-name" required value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} /></Field>
              <Field label="Mục tiêu" htmlFor="ph-goal"><Input id="ph-goal" value={editing.form.goal} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, goal: e.target.value } })} /></Field>
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Bắt đầu" htmlFor="ph-start"><Input id="ph-start" type="date" required value={editing.form.start_date} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, start_date: e.target.value } })} /></Field>
                <Field label="Kết thúc dự kiến" htmlFor="ph-end"><Input id="ph-end" type="date" value={editing.form.end_date ?? ''} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, end_date: e.target.value || null } })} /></Field>
              </div>
              <Field label="Chỉ tiêu cần đạt" htmlFor="ph-targets" hint="Ví dụ: giảm 3 kg; đau lưng xuống mức 2/10">
                <Textarea id="ph-targets" value={editing.form.targets} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, targets: e.target.value } })} />
              </Field>
              <Field label="Trạng thái" htmlFor="ph-status">
                <NativeSelect id="ph-status" value={editing.form.status} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, status: e.target.value as PhaseStatus } })}>
                  {Object.entries(PHASE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              <DialogFooter><Button type="submit" disabled={pending}>Lưu</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
