'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { EyeOff, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDateTime } from '@/lib/date'
import { confirmDialog } from '@/components/ui/app-dialog'
import { Pager, usePaged } from '@/components/ui/pagination'
import { addNote, deleteNote } from '../actions'

type Note = { id: string; content: string; coach_only: boolean; created_at: string; author: string }

export function NotesClient({ clientId, notes }: { clientId: string; notes: Note[] }) {
  const [text, setText] = useState('')
  const [coachOnly, setCoachOnly] = useState(true)
  const [pending, start] = useTransition()
  const paged = usePaged(notes, 10)

  return (
    <div className="max-w-2xl">
      <form className="mb-5 space-y-3 rounded-xl border border-border bg-card p-4" onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await addNote(clientId, text, coachOnly)
          if (r.ok) { setText(''); setCoachOnly(true); toast.success('Đã lưu ghi chú.') } else toast.error(r.error)
        })
      }}>
        <Textarea placeholder="Đánh giá chuyên môn, lưu ý chấn thương, nhắc nhở cho khách…" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Checkbox checked={coachOnly} onCheckedChange={(v) => setCoachOnly(v === true)} />
          <span><b>Chỉ HLV thấy</b> <span className="text-muted-foreground">— bỏ chọn để khách cũng xem được</span></span>
        </label>
        <Button type="submit" disabled={pending || !text.trim()} className="w-full">Lưu ghi chú</Button>
      </form>

      <ul className="space-y-3">
        {paged.pageItems.map((n) => (
          <li key={n.id} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              {n.coach_only
                ? <span className="flex items-center gap-1 font-semibold text-warning"><EyeOff className="size-3.5" /> Chỉ HLV thấy</span>
                : <span className="flex items-center gap-1 font-semibold text-success"><Eye className="size-3.5" /> Khách xem được</span>}
              <span>· {n.author} · {formatDateTime(n.created_at)}</span>
              <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Xoá ghi chú" disabled={pending}
                onClick={async () => {
                  if (!(await confirmDialog({ title: 'Xoá ghi chú này?', destructive: true }))) return
                  start(async () => { const r = await deleteNote(clientId, n.id); if (!r.ok) toast.error(r.error) })
                }}><Trash2 /></Button>
            </div>
            <p className="whitespace-pre-line text-sm">{n.content}</p>
          </li>
        ))}
        {notes.length === 0 && <p className="text-sm text-muted-foreground">Chưa có ghi chú.</p>}
      </ul>
      <Pager paged={paged} label="ghi chú" />
    </div>
  )
}
