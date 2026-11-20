'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/form/Field'
import { confirmDialog } from '@/components/ui/app-dialog'
import { Pager, usePaged } from '@/components/ui/pagination'
import { createPt, setPtActive } from './actions'

type Pt = { id: string; full_name: string; email: string; phone: string | null; is_active: boolean; clients: number }

export function StaffManager({ pts }: { pts: Pt[] }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' })
  const [pending, start] = useTransition()
  const paged = usePaged(pts, 12)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await createPt(form)
      if (!r.ok) { toast.error(r.error); return }
      toast.success(r.data?.reused ? 'Tài khoản đã tồn tại — đã kích hoạt lại.' : 'Đã tạo tài khoản và gửi email mời.')
      setOpen(false); setForm({ fullName: '', email: '', phone: '' })
    })
  }

  return (
    <>
      <Button className="mb-4 w-full md:w-auto" onClick={() => setOpen(true)}><Plus /> Thêm PT</Button>

      <ul className="grid gap-3 md:grid-cols-2">
        {paged.pageItems.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.full_name}</p>
                <p className="truncate text-sm text-muted-foreground">{p.email}</p>
                {p.phone && <p className="text-sm text-muted-foreground">{p.phone}</p>}
              </div>
              {p.is_active ? <Badge variant="secondary">{p.clients} khách</Badge> : <Badge variant="destructive">Đã khoá</Badge>}
            </div>
            <Button variant="outline" size="sm" className="mt-3" disabled={pending}
              onClick={async () => {
                if (p.is_active && !(await confirmDialog({ title: `Khoá tài khoản ${p.full_name}?`, description: 'PT sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được nữa. Có thể mở khoá lại sau.', confirmLabel: 'Khoá tài khoản', destructive: true }))) return
                start(async () => {
                const r = await setPtActive(p.id, !p.is_active)
                if (r.ok) toast.success(p.is_active ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.')
                else toast.error(r.error)
                })
              }}>
              {p.is_active ? 'Khoá tài khoản' : 'Mở khoá'}
            </Button>
          </li>
        ))}
      </ul>
      <Pager paged={paged} label="PT" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>Thêm huấn luyện viên</DialogTitle></DialogHeader>
            <Field label="Họ tên" htmlFor="pt-name">
              <Input id="pt-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Email đăng nhập" htmlFor="pt-email" hint="PT sẽ nhận email mời và mã đăng nhập ở địa chỉ này.">
              <Input id="pt-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Số điện thoại" htmlFor="pt-phone">
              <Input id="pt-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={pending}>{pending ? 'Đang tạo…' : 'Tạo tài khoản'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
