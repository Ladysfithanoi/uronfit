'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, ChipGroup } from '@/components/form/Field'
import { formatDate } from '@/lib/date'
import { confirmDialog } from '@/components/ui/app-dialog'
import type { Package } from '@/lib/clients'
import { addClientAccount, removeClientAccount, renewPackage, deleteClient } from '../../actions'

type Account = { id: string; full_name: string; email: string; is_active: boolean; relation: 'self' | 'guardian' }

export function AccountsPanel({ clientId, isKid, accounts, defaultName }: {
  clientId: string; isKid: boolean; accounts: Account[]; defaultName: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [form, setForm] = useState({ email: '', fullName: defaultName, relation: (isKid ? 'guardian' : 'self') as 'self' | 'guardian' })
  const hasSelf = accounts.some((a) => a.relation === 'self')

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">Tài khoản đăng nhập</h2>
      {accounts.length === 0 && <p className="mb-3 text-sm text-muted-foreground">Chưa có tài khoản. Tạo tài khoản để {isKid ? 'phụ huynh' : 'khách'} xem giáo án, thực đơn và tiến độ trong app.</p>}
      <ul className="mb-3 space-y-2">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-lg bg-secondary p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{a.full_name} <Badge variant="outline" className="ml-1">{a.relation === 'guardian' ? 'Phụ huynh' : 'Khách'}</Badge></p>
              <p className="truncate text-xs text-muted-foreground">{a.email}{!a.is_active && ' · đã khoá'}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Gỡ tài khoản" disabled={pending}
              onClick={async () => {
                if (!(await confirmDialog({ title: 'Gỡ tài khoản khỏi hồ sơ?', description: `${a.email} sẽ không xem được hồ sơ này nữa. Nếu tài khoản không còn gắn hồ sơ nào khác, nó sẽ bị khoá.`, confirmLabel: 'Gỡ tài khoản', destructive: true }))) return
                start(async () => {
                  const r = await removeClientAccount(clientId, a.id)
                  if (r.ok) toast.success('Đã gỡ tài khoản.'); else toast.error(r.error)
                })
              }}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}><KeyRound /> {isKid ? 'Thêm tài khoản phụ huynh' : hasSelf ? 'Thêm tài khoản phụ huynh' : 'Tạo tài khoản cho khách'}</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await addClientAccount(clientId, form)
              if (!r.ok) { toast.error(r.error); return }
              toast.success(r.data?.reused ? 'Đã gắn tài khoản có sẵn vào hồ sơ này.' : 'Đã tạo tài khoản và gửi email mời.')
              setOpen(false); setForm({ ...form, email: '' })
            })
          }}>
            <DialogHeader>
              <DialogTitle>Tài khoản đăng nhập</DialogTitle>
              <DialogDescription>Người dùng nhận email mời, đăng nhập bằng mã gửi qua email — không cần mật khẩu. Phụ huynh có nhiều bé dùng cùng một email.</DialogDescription>
            </DialogHeader>
            {!isKid && !hasSelf && (
              <Field label="Loại tài khoản">
                <ChipGroup options={[{ value: 'self', label: 'Chính khách' }, { value: 'guardian', label: 'Phụ huynh' }]}
                  value={[form.relation]} onChange={(v) => setForm({ ...form, relation: v[0] as 'self' | 'guardian' })} />
              </Field>
            )}
            <Field label="Tên người dùng" htmlFor="acc-name"><Input id="acc-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="Email" htmlFor="acc-email"><Input id="acc-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <DialogFooter><Button type="submit" disabled={pending}>{pending ? 'Đang tạo…' : 'Tạo và gửi email mời'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function PackagePanel({ clientId, pkg, history }: { clientId: string; pkg: Package | null; history: Package[] }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [total, setTotal] = useState('')
  const left = pkg ? pkg.total_sessions - pkg.used_sessions : null
  const pct = pkg ? Math.min(100, Math.round((pkg.used_sessions / pkg.total_sessions) * 100)) : 0

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">Gói tập</h2>
      {pkg ? (
        <>
          <p className="font-semibold">{pkg.name}</p>
          <div className="mt-2 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Đã tập {pkg.used_sessions}/{pkg.total_sessions} buổi</span>
            <span className={left! <= 3 ? 'font-bold text-warning' : 'font-bold'}>Còn {left}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Bắt đầu {formatDate(pkg.start_date)}</p>
        </>
      ) : <p className="text-sm text-muted-foreground">Chưa có gói tập.</p>}
      <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(true)}>{pkg ? 'Gia hạn gói mới' : 'Thêm gói tập'}</Button>
      {history.length > 1 && <p className="mt-2 text-xs text-muted-foreground">Đã có {history.length - 1} gói trước đó.</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await renewPackage(clientId, name, Number(total))
              if (r.ok) { toast.success('Đã tạo gói mới.'); setOpen(false) } else toast.error(r.error)
            })
          }}>
            <DialogHeader><DialogTitle>Gói tập mới</DialogTitle><DialogDescription>Gói hiện tại (nếu có) sẽ được đóng lại.</DialogDescription></DialogHeader>
            <Field label="Tên gói" htmlFor="np-name"><Input id="np-name" placeholder="Gói 24 buổi" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Tổng số buổi" htmlFor="np-total"><Input id="np-total" inputMode="numeric" required value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))} /></Field>
            <DialogFooter><Button type="submit" disabled={pending}>Lưu gói</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button variant="destructive" disabled={pending} onClick={async () => {
      if (!(await confirmDialog({
        title: `Xoá vĩnh viễn hồ sơ ${name}?`,
        description: 'Toàn bộ lộ trình, giáo án, thực đơn, số đo và ảnh sẽ bị xoá, không thể hoàn tác.\n\nNếu khách chỉ nghỉ, hãy đổi trạng thái sang "Đã kết thúc".',
        confirmLabel: 'Xoá vĩnh viễn', destructive: true,
      }))) return
      start(async () => {
        const r = await deleteClient(clientId)
        if (r.ok) { toast.success('Đã xoá hồ sơ.'); router.push('/khach-hang') } else toast.error(r.error)
      })
    }}><Trash2 /> Xoá hồ sơ khách</Button>
  )
}
