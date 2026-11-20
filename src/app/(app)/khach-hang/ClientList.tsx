'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import { Pager, usePaged, useScrollTop } from '@/components/ui/pagination'
import { CLIENT_STATUS_LABEL, GOAL_LABEL, TRAINING_TYPE_LABEL } from '@/lib/labels'
import type { ClientStatus, GoalGroup, TrainingType } from '@/lib/types'
import { cn } from '@/lib/utils'

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
  const [q, setQ] = useState('')
  const [pt, setPt] = useState('')
  const [goal, setGoal] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState<string>('active')
  const ptName = useMemo(() => new Map(pts.map((p) => [p.id, p.full_name])), [pts])

  const list = clients.filter((c) =>
    (!q || norm(c.full_name).includes(norm(q)) || (c.phone ?? '').includes(q.replace(/\s/g, ''))) &&
    (!pt || c.pt_id === pt) && (!goal || c.goals.includes(goal as GoalGroup)) &&
    (!type || c.training_type === type) && (!status || c.status === status))
  const paged = usePaged(list, 20, [q, pt, goal, type, status].join('|'))
  const { ref: topRef, scroll } = useScrollTop<HTMLParagraphElement>()

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

      <p ref={topRef} className="label-caps mb-2 scroll-mt-20">{list.length} khách</p>

      {/* Điện thoại: thẻ */}
      <ul className="space-y-2 md:hidden">
        {paged.pageItems.map((c) => {
          const left = remaining(c)
          return (
            <li key={c.id}>
              <Link href={`/khach-hang/${c.id}`} className="block rounded-xl border border-border bg-card p-4 active:bg-secondary">
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
              <th className="px-4 py-3 font-semibold">Khách</th>
              {isFm && <th className="px-4 py-3 font-semibold">PT</th>}
              <th className="px-4 py-3 font-semibold">Mục tiêu</th>
              <th className="px-4 py-3 font-semibold">Hình thức</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 text-right font-semibold">Buổi còn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.pageItems.map((c) => {
              const left = remaining(c)
              return (
                <tr key={c.id} className="hover:bg-card">
                  <td className="px-4 py-3">
                    <Link href={`/khach-hang/${c.id}`} className="font-semibold hover:text-brand">{c.full_name}</Link>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </td>
                  {isFm && <td className="px-4 py-3 text-muted-foreground">{c.pt_id ? ptName.get(c.pt_id) : '—'}</td>}
                  <td className="px-4 py-3 text-muted-foreground">{c.goals.map((g) => GOAL_LABEL[g]).join(', ')}</td>
                  <td className="px-4 py-3">{TRAINING_TYPE_LABEL[c.training_type]}</td>
                  <td className={cn('px-4 py-3', STATUS_STYLE[c.status])}>{CLIENT_STATUS_LABEL[c.status]}</td>
                  <td className={cn('px-4 py-3 text-right font-semibold', left !== null && left <= 3 && 'text-warning')}>{left ?? '—'}</td>
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
