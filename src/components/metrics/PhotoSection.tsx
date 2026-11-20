'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Download, ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Field } from '@/components/form/Field'
import { confirmDialog } from '@/components/ui/app-dialog'
import { Pager, usePaged } from '@/components/ui/pagination'
import { createClient } from '@/lib/supabase/client'
import { compressImage, randomFileName } from '@/lib/image'
import { composeBeforeAfter } from '@/lib/transform-compose'
import { formatDate, todayVN } from '@/lib/date'
import type { Measurement } from '@/lib/metrics'
import { addPhotos, deletePhoto } from '@/app/actions/metrics'

export type Photo = { id: string; taken_on: string; angle: string; phase_id: string | null; url: string | null }

const ANGLE: Record<string, string> = { front: 'Trước', back: 'Sau', left: 'Bên trái', right: 'Bên phải', other: 'Khác' }

export function PhotoSection({ clientId, clientName, photos, phases, canEdit, consent, weights }: {
  clientId: string; clientName: string; photos: Photo[]; phases: { id: string; name: string }[]
  canEdit: boolean; consent: boolean; weights: Measurement[]
}) {
  const [pending, start] = useTransition()
  const [date, setDate] = useState(todayVN())
  const [angle, setAngle] = useState('front')
  const [files, setFiles] = useState<FileList | null>(null)
  const dates = useMemo(() => [...new Set(photos.map((p) => p.taken_on))].sort(), [photos])
  const [a, setA] = useState(dates[0] ?? '')
  const [b, setB] = useState(dates.at(-1) ?? '')
  const [cmpAngle, setCmpAngle] = useState('front')
  const phaseName = new Map(phases.map((p) => [p.id, p.name]))
  const byDateDesc = useMemo(() => [...dates].reverse(), [dates])
  const paged = usePaged(byDateDesc, 4)
  const pick = (d: string) => photos.find((p) => p.taken_on === d && p.angle === cmpAngle) ?? null
  const pa = pick(a), pb = pick(b)
  const weightOn = (d: string) => {
    const w = weights.filter((x) => x.measured_on <= d && x.value_num !== null).at(-1)
    return w ? Number(w.value_num) : null
  }

  function upload() {
    if (!files?.length) return
    start(async () => {
      try {
        const supabase = createClient()
        const rows: { path: string; taken_on: string; angle: string }[] = []
        for (const f of Array.from(files)) {
          const blob = await compressImage(f)
          const path = `${clientId}/progress/${randomFileName()}`
          const { error } = await supabase.storage.from('client-media').upload(path, blob, { contentType: 'image/jpeg' })
          if (error) throw error
          rows.push({ path, taken_on: date, angle })
        }
        const r = await addPhotos(clientId, rows)
        if (!r.ok) throw new Error(r.error)
        toast.success(`Đã tải ${rows.length} ảnh.`)
        setFiles(null)
      } catch (e) {
        toast.error(e instanceof Error && /[À-ỹ]/.test(e.message) ? e.message : 'Không tải được ảnh, vui lòng thử lại.')
      }
    })
  }

  async function download() {
    if (!pa?.url || !pb?.url) return
    try {
      const blob = await composeBeforeAfter(
        { url: pa.url, label: 'TRƯỚC', date: formatDate(a), weight: weightOn(a) },
        { url: pb.url, label: 'SAU', date: formatDate(b), weight: weightOn(b) },
      )
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `UR-truoc-sau-${clientName.split(' ').pop()}.jpg`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 5000)
    } catch { toast.error('Không ghép được ảnh.') }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">Ảnh tiến độ & tư thế</h2>
      <p className="mb-3 text-xs text-muted-foreground">Ảnh lưu ở kho riêng tư, chỉ mở được bằng link có thời hạn.</p>

      {canEdit && (
        <div className="mb-5 space-y-3 rounded-lg bg-secondary p-3">
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Ngày chụp" htmlFor="ph-date"><Input id="ph-date" type="date" max={todayVN()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Góc chụp" htmlFor="ph-angle">
              <NativeSelect id="ph-angle" value={angle} onChange={(e) => setAngle(e.target.value)}>
                {Object.entries(ANGLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Input type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} aria-label="Chọn ảnh" />
          <Button className="w-full" disabled={pending || !files?.length} onClick={upload}><ImagePlus /> {pending ? 'Đang tải…' : 'Tải ảnh lên'}</Button>
        </div>
      )}

      {dates.length >= 1 && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold">So sánh hai mốc</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <NativeSelect value={a} onChange={(e) => setA(e.target.value)} aria-label="Mốc trước">{dates.map((d) => <option key={d} value={d}>{formatDate(d)}</option>)}</NativeSelect>
            <NativeSelect value={b} onChange={(e) => setB(e.target.value)} aria-label="Mốc sau">{dates.map((d) => <option key={d} value={d}>{formatDate(d)}</option>)}</NativeSelect>
            <NativeSelect value={cmpAngle} onChange={(e) => setCmpAngle(e.target.value)} aria-label="Góc">{Object.entries(ANGLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[[a, pa], [b, pb]].map(([d, p], i) => (
              <figure key={i} className="overflow-hidden rounded-lg border border-border bg-black">
                <div className="aspect-[3/4]">
                  {(p as Photo | null)?.url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={(p as Photo).url!} alt={`Ảnh ${ANGLE[cmpAngle]} ngày ${formatDate(d as string)}`} className="size-full object-cover" />
                    : <div className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">Không có ảnh góc {ANGLE[cmpAngle].toLowerCase()} ngày này</div>}
                </div>
                <figcaption className="p-2 text-center text-xs"><b>{i === 0 ? 'Trước' : 'Sau'}</b> · {formatDate(d as string)}{weightOn(d as string) ? ` · ${String(weightOn(d as string)).replace('.', ',')} kg` : ''}</figcaption>
              </figure>
            ))}
          </div>
          {canEdit && pa?.url && pb?.url && a !== b && (
            consent
              ? <Button variant="outline" className="mt-3 w-full" onClick={download}><Download /> Tải ảnh ghép Trước/Sau</Button>
              : <p className="mt-3 text-xs text-muted-foreground">Khách chưa đồng ý dùng ảnh — bật trong Sửa hồ sơ để tải ảnh ghép.</p>
          )}
        </div>
      )}

      {dates.length > 0 ? (
        <div className="space-y-4">
          {paged.pageItems.map((d) => (
            <div key={d}>
              <p className="mb-2 text-sm"><b>{formatDate(d)}</b>{(() => { const pid = photos.find((p) => p.taken_on === d)?.phase_id; return pid ? <span className="text-muted-foreground"> · {phaseName.get(pid)}</span> : null })()}</p>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {photos.filter((p) => p.taken_on === d).map((p) => (
                  <div key={p.id} className="relative overflow-hidden rounded-lg border border-border">
                    {p.url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={`Ảnh ${ANGLE[p.angle]}`} className="aspect-[3/4] w-full object-cover" /></a>
                      : <div className="aspect-[3/4]" />}
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px]">{ANGLE[p.angle]}</span>
                    {canEdit && (
                      <button type="button" aria-label="Xoá ảnh" disabled={pending}
                        className="absolute right-0 top-0 flex size-11 items-center justify-center text-white drop-shadow"
                        onClick={async () => {
                          if (!(await confirmDialog({ title: 'Xoá ảnh này?', description: 'Ảnh bị xoá khỏi kho lưu trữ, không khôi phục được.', destructive: true }))) return
                          start(async () => { const r = await deletePhoto(clientId, p.id); if (!r.ok) toast.error(r.error) })
                        }}>
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Pager paged={paged} label="ngày chụp" />
        </div>
      ) : <p className="text-sm text-muted-foreground">Chưa có ảnh.</p>}
    </section>
  )
}
