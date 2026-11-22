'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/form/Field'
import { confirmDialog } from '@/components/ui/app-dialog'
import { FEATURES, type Tier } from '@/lib/features'
import { cn } from '@/lib/utils'
import { saveTier, toggleTierFeature, setDefaultTier, deleteTier } from './actions'

type Res = { ok: boolean; error?: string }

export function TierManager({ tiers, counts }: { tiers: Tier[]; counts: Record<string, number> }) {
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState<null | { id?: string; name: string; description: string; features: string[] }>(null)
  const act = (p: Promise<Res>, ok?: string) => start(async () => { const r = await p; if (r.ok) { if (ok) toast.success(ok) } else toast.error(r.error) })

  async function remove(t: Tier) {
    if (await confirmDialog({
      title: `Xoá gói "${t.name}"?`,
      description: `${counts[t.id] ?? 0} khách đang dùng gói này sẽ chuyển sang gói mặc định.`, destructive: true,
    })) act(deleteTier(t.id), 'Đã xoá gói.')
  }

  return (
    <>
      <Button className="mb-4" onClick={() => setEdit({ name: '', description: '', features: ['workout_view', 'meal_view'] })}><Plus /> Thêm gói</Button>

      {/* Bảng tính năng × gói */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-card">
            <tr>
              <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tính năng</th>
              {tiers.map((t) => (
                <th key={t.id} className="min-w-36 px-3 py-3 text-center align-top">
                  <p className="font-bold">{t.name}</p>
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">{counts[t.id] ?? 0} khách</p>
                  {t.is_default && <Badge className="mt-1 bg-brand/15 text-brand"><Star /> Mặc định</Badge>}
                  <div className="mt-1 flex justify-center gap-0.5">
                    <Button size="icon-sm" variant="ghost" aria-label={`Sửa gói ${t.name}`} title="Đổi tên / mô tả"
                      onClick={() => setEdit({ id: t.id, name: t.name, description: t.description ?? '', features: t.features })}><Pencil /></Button>
                    {!t.is_default && <Button size="icon-sm" variant="ghost" aria-label={`Đặt ${t.name} làm mặc định`} title="Đặt làm gói mặc định" disabled={pending}
                      onClick={() => act(setDefaultTier(t.id), `Khách chưa gắn gói sẽ dùng gói ${t.name}.`)}><Star /></Button>}
                    {!t.is_default && <Button size="icon-sm" variant="ghost" className="text-destructive" aria-label={`Xoá gói ${t.name}`} title="Xoá gói" disabled={pending}
                      onClick={() => remove(t)}><Trash2 /></Button>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {FEATURES.map((f) => (
              <tr key={f.key} className="hover:bg-card/60">
                <td className="sticky left-0 z-10 bg-background px-4 py-3">
                  <p className="font-medium">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </td>
                {tiers.map((t) => {
                  const on = t.features.includes(f.key)
                  return (
                    <td key={t.id} className={cn('px-3 py-3 text-center', on && 'bg-brand/5')}>
                      <label className="inline-flex size-11 items-center justify-center">
                        <Checkbox checked={on} disabled={pending} aria-label={`${f.label} — gói ${t.name}`}
                          onCheckedChange={(v) => act(toggleTierFeature(t.id, f.key, v === true))} />
                      </label>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Gán gói cho khách trong <b className="text-foreground">Sửa hồ sơ khách</b>. Khách chưa gắn gói dùng gói <b className="text-foreground">Mặc định</b>.
        Phụ huynh nhiều bé: mỗi bé theo gói riêng.
      </p>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {edit && (
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const r = await saveTier(edit, edit.id)
                if (r.ok) { toast.success('Đã lưu gói.'); setEdit(null) } else toast.error(r.error)
              })
            }}>
              <DialogHeader><DialogTitle>{edit.id ? 'Sửa gói' : 'Thêm gói dịch vụ'}</DialogTitle></DialogHeader>
              <Field label="Tên gói" htmlFor="tier-name"><Input id="tier-name" required placeholder="Vd: Bạch kim" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Mô tả ngắn (tuỳ chọn)" htmlFor="tier-desc"><Input id="tier-desc" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              {!edit.id && (
                <Field label="Tính năng">
                  <ul className="space-y-1">
                    {FEATURES.map((f) => (
                      <li key={f.key}>
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                          <Checkbox checked={edit.features.includes(f.key)}
                            onCheckedChange={(v) => setEdit({ ...edit, features: v === true ? [...edit.features, f.key] : edit.features.filter((x) => x !== f.key) })} />
                          {f.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
              <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button>
                <Button type="submit" disabled={pending}>Lưu</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
