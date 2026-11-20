'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mail, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/form/Field'
import { updateMyProfile, requestEmailChange, confirmEmailChange, cancelEmailChange } from './actions'

type Me = { full_name: string; email: string; phone: string | null; roleLabel: string; canChangeEmail: boolean }

export function AccountEditor({ me }: { me: Me }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState<null | { full_name: string; phone: string }>(null)
  const [mail, setMail] = useState<null | { step: 'email' | 'code'; email: string; code: string; cooldown: number }>(null)

  function sendCode() {
    if (!mail) return
    start(async () => {
      const r = await requestEmailChange(mail.email)
      if (!r.ok) { toast.error(r.error); return }
      toast.success(`Đã gửi mã tới ${r.data!.email}.`)
      setMail({ ...mail, email: r.data!.email, step: 'code', code: '' })
    })
  }

  function confirm(code = mail?.code ?? '') {
    if (code.length < 6) return
    start(async () => {
      const r = await confirmEmailChange(code)
      if (!r.ok) { toast.error(r.error); setMail((m) => (m ? { ...m, code: '' } : m)); return }
      toast.success(`Email đăng nhập đã đổi sang ${r.data!.email}. Lần sau hãy đăng nhập bằng email này.`)
      setMail(null)
      router.refresh()
    })
  }

  return (
    <>
      <dl className="divide-y divide-border rounded-xl border border-border bg-card">
        <Row label="Họ tên" value={me.full_name} />
        <Row label="Số điện thoại" value={me.phone || '—'} />
        <Row label="Email đăng nhập" value={me.email} />
        <Row label="Vai trò" value={me.roleLabel} />
      </dl>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={() => setEdit({ full_name: me.full_name, phone: me.phone ?? '' })}><Pencil /> Sửa thông tin</Button>
        {me.canChangeEmail && (
          <Button variant="outline" onClick={() => setMail({ step: 'email', email: '', code: '', cooldown: 0 })}><Mail /> Đổi email đăng nhập</Button>
        )}
      </div>

      {/* Sửa họ tên, số điện thoại */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          {edit && (
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const r = await updateMyProfile(edit)
                if (r.ok) { toast.success('Đã lưu thông tin.'); setEdit(null); router.refresh() } else toast.error(r.error)
              })
            }}>
              <DialogHeader><DialogTitle>Sửa thông tin tài khoản</DialogTitle></DialogHeader>
              <Field label="Họ tên" htmlFor="acc-name"><Input id="acc-name" required value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></Field>
              <Field label="Số điện thoại" htmlFor="acc-phone"><Input id="acc-phone" inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
              <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button>
                <Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Đổi email: 1) nhập email mới → 2) nhập mã gửi tới email mới */}
      <Dialog open={!!mail} onOpenChange={(o) => { if (!o) { if (mail?.step === 'code') void cancelEmailChange(); setMail(null) } }}>
        <DialogContent>
          {mail?.step === 'email' && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); sendCode() }}>
              <DialogHeader>
                <DialogTitle>Đổi email đăng nhập</DialogTitle>
                <DialogDescription>Chúng tôi gửi mã xác nhận tới email mới để chắc chắn bạn dùng được hộp thư đó. Email hiện tại: {me.email}</DialogDescription>
              </DialogHeader>
              <Field label="Email mới" htmlFor="new-email">
                <Input id="new-email" type="email" inputMode="email" autoComplete="email" required autoFocus value={mail.email} onChange={(e) => setMail({ ...mail, email: e.target.value })} />
              </Field>
              <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={() => setMail(null)}>Huỷ</Button>
                <Button type="submit" disabled={pending || !mail.email}>{pending ? 'Đang gửi…' : 'Gửi mã xác nhận'}</Button>
              </DialogFooter>
            </form>
          )}
          {mail?.step === 'code' && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); confirm() }}>
              <DialogHeader>
                <DialogTitle>Nhập mã xác nhận</DialogTitle>
                <DialogDescription>Mã 6 số đã gửi tới <b className="text-foreground">{mail.email}</b> (hiệu lực 15 phút). Không thấy thư? Xem thư mục Spam.</DialogDescription>
              </DialogHeader>
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus placeholder="••••••" aria-label="Mã xác nhận"
                className="h-14 text-center text-2xl font-bold tracking-[0.5em]" value={mail.code}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setMail({ ...mail, code: v }); if (v.length === 6) confirm(v) }} />
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" disabled={pending} onClick={() => setMail({ ...mail, step: 'email', code: '' })}>Đổi email khác</Button>
                <Button type="button" variant="secondary" disabled={pending} onClick={sendCode}>Gửi lại mã</Button>
                <Button type="submit" disabled={pending || mail.code.length < 6}>{pending ? 'Đang kiểm tra…' : 'Xác nhận'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-sm font-medium">{value}</dd>
    </div>
  )
}
