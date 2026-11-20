'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/date'

type Device = { id: string; label: string; first_seen: string; last_seen: string; current: boolean }

export function DeviceList({ devices }: { devices: Device[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ id?: string; others?: true; label: string } | null>(null)
  const others = devices.filter((d) => !d.current)

  async function revoke() {
    if (!confirm) return
    setBusy(true)
    const res = await fetch('/api/devices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(confirm.others ? { others: true } : { id: confirm.id }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false); setConfirm(null)
    if (!res.ok) { toast.error(json.error ?? 'Không đăng xuất được thiết bị.'); return }
    toast.success(confirm.others ? `Đã đăng xuất ${json.revoked} thiết bị khác.` : 'Đã đăng xuất thiết bị.')
    router.refresh()
  }

  return (
    <>
      <ul className="space-y-3">
        {devices.map((d) => {
          const Icon = /iPhone|iPad|Android/.test(d.label) ? Smartphone : Monitor
          return (
            <li key={d.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.label}</p>
                  {d.current && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-brand">
                      <ShieldCheck className="size-3.5" /> Máy đang dùng
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Đăng nhập lần đầu: {formatDateTime(d.first_seen)}</p>
                  <p className="text-xs text-muted-foreground">Dùng gần nhất: {formatDateTime(d.last_seen)}</p>
                </div>
              </div>
              {!d.current && (
                <Button variant="outline" className="mt-3 w-full"
                  onClick={() => setConfirm({ id: d.id, label: d.label })}>
                  Đăng xuất máy này
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {others.length > 0 && (
        <Button variant="destructive" size="lg" className="mt-6 w-full"
          onClick={() => setConfirm({ others: true, label: `${others.length} thiết bị khác` })}>
          Đăng xuất tất cả máy khác
        </Button>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đăng xuất {confirm?.label}?</DialogTitle>
            <DialogDescription>
              Thiết bị sẽ bị đăng xuất ngay ở thao tác tiếp theo. Muốn dùng lại, máy đó phải nhận mã qua email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary">Huỷ</Button>} />
            <Button variant="destructive" disabled={busy} onClick={revoke}>
              {busy ? 'Đang xử lý…' : 'Đăng xuất'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
