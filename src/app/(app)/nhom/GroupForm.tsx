'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, ChipGroup } from '@/components/form/Field'
import { saveGroup } from './actions'

type C = { id: string; full_name: string; is_kid: boolean; training_type: string; pt_id: string | null }

export function GroupForm({ clients, pts, isFm, meId, group }: {
  clients: C[]; pts: { id: string; full_name: string }[]; isFm: boolean; meId: string
  group?: { id: string; name: string; type: 'one_on_two' | 'kids'; pt_id: string | null; memberIds: string[] }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [f, setF] = useState({
    name: group?.name ?? '', type: group?.type ?? ('kids' as 'one_on_two' | 'kids'),
    ptId: (group?.pt_id ?? (isFm ? pts[0]?.id ?? null : meId)) as string | null, memberIds: group?.memberIds ?? [] as string[],
  })
  const max = f.type === 'one_on_two' ? 2 : 3
  // Gợi ý: nhóm trẻ em → khách trẻ em; nhóm 1:2 → khách người lớn. Chỉ khách của PT phụ trách nhóm.
  const candidates = clients.filter((c) => (f.type === 'kids' ? c.is_kid : !c.is_kid) && (!f.ptId || c.pt_id === f.ptId || f.memberIds.includes(c.id)))

  return (
    <>
      {group
        ? <Button variant="outline" onClick={() => setOpen(true)}><Pencil /> Sửa nhóm</Button>
        : <Button onClick={() => setOpen(true)}><Plus /> <span className="hidden sm:inline">Tạo nhóm</span></Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await saveGroup(f, group?.id)
              if (!r.ok) { toast.error(r.error); return }
              toast.success('Đã lưu nhóm.'); setOpen(false)
              if (!group) router.push(`/nhom/${r.data!.id}`)
            })
          }}>
            <DialogHeader><DialogTitle>{group ? 'Sửa nhóm' : 'Tạo nhóm'}</DialogTitle></DialogHeader>
            <Field label="Loại nhóm">
              <ChipGroup options={[{ value: 'kids', label: 'Nhóm trẻ em (2–3 bé)' }, { value: 'one_on_two', label: '1:2' }]}
                value={[f.type]} onChange={(v) => setF({ ...f, type: v[0] as 'kids' | 'one_on_two', memberIds: [] })} />
            </Field>
            <Field label="Tên nhóm" htmlFor="g-name"><Input id="g-name" required placeholder="Nhóm trẻ em thứ 7" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            {isFm && (
              <Field label="PT phụ trách" htmlFor="g-pt">
                <NativeSelect id="g-pt" value={f.ptId ?? ''} onChange={(e) => setF({ ...f, ptId: e.target.value || null, memberIds: [] })}>
                  {pts.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </NativeSelect>
              </Field>
            )}
            <Field label={`Thành viên (${f.memberIds.length}/${max})`}>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {candidates.map((c) => {
                  const on = f.memberIds.includes(c.id)
                  return (
                    <li key={c.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-secondary">
                        <Checkbox checked={on} disabled={!on && f.memberIds.length >= max}
                          onCheckedChange={(v) => setF({ ...f, memberIds: v === true ? [...f.memberIds, c.id] : f.memberIds.filter((x) => x !== c.id) })} />
                        <span className="text-sm">{c.full_name}</span>
                      </label>
                    </li>
                  )
                })}
                {candidates.length === 0 && <li className="p-2 text-sm text-muted-foreground">Không có khách phù hợp. Tạo hồ sơ khách {f.type === 'kids' ? 'trẻ em ' : ''}trước.</li>}
              </ul>
            </Field>
            <DialogFooter><Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu nhóm'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
