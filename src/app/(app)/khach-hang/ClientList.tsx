'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Search, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/native-select'
import { Pager, usePaged, useScrollTop } from '@/components/ui/pagination'
import { confirmDialog } from '@/components/ui/app-dialog'
import { CLIENT_STATUS_LABEL, GOAL_LABEL, TRAINING_TYPE_LABEL } from '@/lib/labels'
import type { ClientStatus, GoalGroup, TrainingType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { deleteClients } from './actions'

export type ListClient = {
  id: string; full_name: string; phone: string | null; goals: GoalGroup[]; training_type: TrainingType
  status: ClientStatus; pt_id: string | null; is_kid: boolean
  client_packages: { total_sessions: number; used_sessions: number; is_active: boolean; start_date: string }[]
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

function remaining(c: ListClient) {
  const p = c.client_packages.filter((x) => x.is_active).sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0]
  return p ? p.total_sessions - p.used_sessions : null
}

const STATUS_STYLE: Record<ClientStatus, string> = {
  active: 'text-success', paused: 'text-warning', ended: 'text-muted-foreground',
}

export function ClientList({ clients, pts, isFm }: { clients: ListClient[]; pts: { id: string; full_name: string }[]; isFm: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [pt, setPt] = useState('')
  const [goal, setGoal] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState<string>('active')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()
  const ptName = useMemo(() => new Map(pts.map((p) => [p.id, p.full_name])), [pts])

  const list = clients.filter((c) =>
    (!q || norm(c.full_name).includes(norm(q)) || (c.phone ?? '').includes(q.replace(/\s/g, ''))) &&
    (!pt || c.pt_id === pt) && (!goal || c.goals.includes(goal as GoalGroup)) &&
    (!type || c.training_type === type) && (!status || c.status === status))
  const paged = usePaged(list, 20, [q, pt, goal, type, status].join('|'))
  const { ref: topRef, scroll } = useScrollTop<HTMLParagraphElement>()

  // Chỉ tính những khách đã chọn còn tồn tại (sau khi xoá danh sách tải lại)
  const existing = useMemo(() => new Set(clients.map((c) => c.id)), [clients])
  const selected = [...picked].filter((id) => existing.has(id))
  const pageIds = paged.pageItems.map((c) => c.id)
  const pageAll = pageIds.length > 0 && pageIds.every((id) => picked.has(id))
  const pageSome = pageIds.some((id) => picked.has(id))
  const listAll = list.length > 0 && list.every((c) => picked.has(c.id))

  const toggle = (id: string, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  const togglePage = (on: boolean) => setPicked((s) => { const n = new Set(s); for (const id of pageIds) { if (on) n.add(id); else n.delete(id) } return n })

  async function remove(ids: string[]) {
    const names = clients.filter((c) => ids.includes(c.id)).map((c) => c.full_name)
    const shown = names.slice(0, 5).join(', ') + (names.length > 5 ? ` và ${names.length - 5} khách khác` : '')
    if (!(await confirmDialog({
      title: ids.length === 1 ? `Xoá hồ sơ ${names[0]}?` : `Xoá ${ids.length} hồ sơ khách?`,
      description: `${ids.length > 1 ? shown + '.\n\n' : ''}Toàn bộ lộ trình, giáo án, thực đơn, số đo và ảnh sẽ bị xoá vĩnh viễn, không thể hoàn tác. Tài khoản đăng nhập không còn gắn hồ sơ nào sẽ bị khoá.\n\nNếu khách chỉ nghỉ, hãy đổi trạng thái sang "Đã kết thúc".`,
      confirmLabel: ids.length === 1 ? 'Xoá vĩnh viễn' : `Xoá ${ids.length} khách`, destructive: true,
    }))) return
    start(async () => {
      const r = await deleteClients(ids)
      if (!r.ok) { toast.error(r.error); return }
      toast.success(`Đã xoá ${r.data?.deleted ?? ids.length} hồ sơ khách.`)
      setPicked(new Set())
      router.refresh()
    })
  }

  return (
    <>
      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Tìm theo tên hoặc số điện thoại" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm khách" />
        </div>
        <div className={cn('grid grid-cols-2 gap-2', isFm ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
          {isFm && (
            <NativeSelect value={pt} onChange={(e) => setPt(e.target.value)} aria-label="Lọc theo PT">
              <option value="">Tất cả PT</option>
              {pts.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </NativeSelect>
          )}
          <NativeSelect value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Lọc theo mục tiêu">
            <option value="">Mọi mục tiêu</option>
            {Object.entries(GOAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)} aria-label="Lọc theo hình thức">
            <option value="">Mọi hình thức</option>
            {Object.entries(TRAINING_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc theo trạng thái">
            <option value="">Mọi trạng thái</option>
            {Object.entries(CLIENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        </div>
      </div>

      <div className="mb-2 flex min-h-11 items-center gap-3">
        {isFm && list.length > 0 && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox checked={pageAll} indeterminate={!pageAll && pageSome} onCheckedChange={(v) => togglePage(v === true)} aria-label="Chọn tất cả khách trên trang này" />
            <span className="text-muted-foreground">Chọn cả trang</span>
          </label>
        )}
        <p ref={topRef} className="label-caps scroll-mt-20">{list.length} khách</p>
      </div>

      {/* Thanh thao tác hàng loạt — chỉ FM, hiện khi đã chọn */}
      {isFm && selected.length > 0 && (
        <div role="region" aria-label="Thao tác với khách đã chọn"
          className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand/50 bg-card p-2 pl-4 shadow-lg md:top-4">
          <span className="text-sm font-semibold">Đã chọn {selected.length}</span>
          {pageAll && !listAll && list.length > pageIds.length && (
            <Button variant="link" size="sm" onClick={() => setPicked((s) => new Set([...s, ...list.map((c) => c.id)]))}>
              Chọn tất cả {list.length} khách đang lọc
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => setPicked(new Set())}><X /> Bỏ chọn</Button>
            <Button variant="destructive" disabled={pending} onClick={() => remove(selected)}>
              <Trash2 /> {pending ? 'Đang xoá…' : `Xoá ${selected.length} khách`}
            </Button>
          </div>
        </div>
      )}

      {/* Điện thoại: thẻ */}
      <ul className="space-y-2 md:hidden">
        {paged.pageItems.map((c) => {
          const left = remaining(c)
          const on = picked.has(c.id)
          return (
            <li key={c.id} className={cn('flex items-stretch gap-2 rounded-xl border bg-card', on ? 'border-brand' : 'border-border')}>
              {isFm && (
                <label className="flex w-11 shrink-0 items-center justify-center pl-2">
                  <Checkbox checked={on} onCheckedChange={(v) => toggle(c.id, v === true)} aria-label={`Chọn ${c.full_name}`} />
                </label>
              )}
              <Link href={`/khach-hang/${c.id}`} className={cn('block min-w-0 flex-1 p-4 active:bg-secondary', isFm && 'pl-1')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TRAINING_TYPE_LABEL[c.training_type]} · <span className={STATUS_STYLE[c.status]}>{CLIENT_STATUS_LABEL[c.status]}</span>
                      {isFm && c.pt_id && <> · {ptName.get(c.pt_id)}</>}
                    </p>
                  </div>
                  {left !== null && (
                    <div className="text-right">
                      <p className={cn('font-bold', left <= 3 && 'text-warning')}>{left}</p>
                      <p className="text-[11px] text-muted-foreground">buổi còn</p>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.goals.map((g) => <Badge key={g} variant="secondary">{GOAL_LABEL[g]}</Badge>)}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Máy tính: bảng */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {isFm && (
                <th className="w-12 px-4 py-3">
                  <Checkbox checked={pageAll} indeterminate={!pageAll && pageSome} onCheckedChange={(v) => togglePage(v === true)} aria-label="Chọn tất cả khách trên trang này" />
                </th>
              )}
              <th className="px-4 py-3 font-semibold">Khách</th>
              {isFm && <th className="px-4 py-3 font-semibold">PT</th>}
              <th className="px-4 py-3 font-semibold">Mục tiêu</th>
              <th className="px-4 py-3 font-semibold">Hình thức</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 text-right font-semibold">Buổi còn</th>
              <th className="w-28 px-4 py-3"><span className="sr-only">Thao tác</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.pageItems.map((c) => {
              const left = remaining(c)
              const on = picked.has(c.id)
              return (
                <tr key={c.id} className={cn('hover:bg-card', on && 'bg-brand/10 hover:bg-brand/15')}>
                  {isFm && (
                    <td className="px-4 py-3">
                      <Checkbox checked={on} onCheckedChange={(v) => toggle(c.id, v === true)} aria-label={`Chọn ${c.full_name}`} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link href={`/khach-hang/${c.id}`} className="font-semibold hover:text-brand">{c.full_name}</Link>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </td>
                  {isFm && <td className="px-4 py-3 text-muted-foreground">{c.pt_id ? ptName.get(c.pt_id) : '—'}</td>}
                  <td className="px-4 py-3 text-muted-foreground">{c.goals.map((g) => GOAL_LABEL[g]).join(', ')}</td>
                  <td className="px-4 py-3">{TRAINING_TYPE_LABEL[c.training_type]}</td>
                  <td className={cn('px-4 py-3', STATUS_STYLE[c.status])}>{CLIENT_STATUS_LABEL[c.status]}</td>
                  <td className={cn('px-4 py-3 text-right font-semibold', left !== null && left <= 3 && 'text-warning')}>{left ?? '—'}</td>
                  <td className="px-2 py-1 text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/khach-hang/${c.id}/sua`} className={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label={`Sửa hồ sơ ${c.full_name}`} title="Sửa hồ sơ"><Pencil /></Link>
                      {isFm && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={pending}
                          aria-label={`Xoá hồ sơ ${c.full_name}`} title="Xoá hồ sơ" onClick={() => remove([c.id])}><Trash2 /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Không có khách phù hợp bộ lọc.</p>}
      <Pager paged={paged} label="khách" onChange={scroll} />
    </>
  )
}
