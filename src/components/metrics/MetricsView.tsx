'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, ChipGroup } from '@/components/form/Field'
import { MetricChart } from './MetricChart'
import { confirmDialog } from '@/components/ui/app-dialog'
import { Pager, usePaged } from '@/components/ui/pagination'
import { PhotoSection, type Photo } from './PhotoSection'
import { formatDate, todayVN } from '@/lib/date'
import { cleanDecimalInput, fmtDelta, fmtNum } from '@/lib/num'
import { phaseForDate } from '@/lib/clients'
import { weeklyAverages, type Measurement, type MetricType } from '@/lib/metrics'
import { cn } from '@/lib/utils'
import { saveMeasurements, deleteMeasurementsOn, toggleOptionalMetric, addCustomMetric, deleteCustomMetric } from '@/app/actions/metrics'

type PhaseLite = { id: string; name: string; start_date: string; end_date: string | null; sort_order: number }

export function MetricsView(props: {
  clientId: string; clientName: string; viewer: 'staff' | 'client'; metrics: MetricType[]; optional: MetricType[]
  enabled: string[]; measurements: Measurement[]; phases: PhaseLite[]; photos: Photo[]; photoConsent: boolean
  canEnter?: boolean; showPhotos?: boolean
}) {
  const { clientId, viewer, metrics, measurements, phases } = props
  const isStaff = viewer === 'staff'
  const numeric = metrics.filter((m) => m.kind === 'number')
  const [chartMetric, setChartMetric] = useState(numeric[0]?.id ?? '')

  const byMetric = useMemo(() => {
    const m = new Map<string, Measurement[]>()
    for (const x of measurements) m.set(x.metric_type_id, [...(m.get(x.metric_type_id) ?? []), x])
    return m
  }, [measurements])

  const chartType = metrics.find((m) => m.id === chartMetric)
  const chartPoints = (byMetric.get(chartMetric) ?? []).filter((x) => x.value_num !== null).map((x) => ({ date: x.measured_on, value: Number(x.value_num) }))
  const weeks = weeklyAverages(chartPoints)
  const lastWeek = weeks.at(-1), prevWeek = weeks.at(-2)

  return (
    <div className="space-y-6">
      {(isStaff || props.canEnter !== false) && <EntryForm {...props} />}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="label-caps mb-3 text-brand">Biểu đồ</h2>
        {numeric.length > 0 ? (
          <>
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {numeric.map((m) => (
                <button key={m.id} type="button" onClick={() => setChartMetric(m.id)} aria-pressed={m.id === chartMetric}
                  className={cn('min-h-10 shrink-0 rounded-full border px-3 text-sm', m.id === chartMetric ? 'border-brand bg-brand/15' : 'border-border text-muted-foreground')}>
                  {m.name}
                </button>
              ))}
            </div>
            <h3 className="mb-1 text-base font-semibold">{chartType?.name}{chartType?.unit ? ` (${chartType.unit})` : ''}</h3>
            {weeks.length >= 1 && chartPoints.length >= 2 && (
              <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">TB tuần này: <b className="text-foreground">{fmtNum(lastWeek!.avg)}</b></span>
                {prevWeek && <span className="text-muted-foreground">So với tuần trước: <b className="text-foreground">{fmtDelta(Math.round((lastWeek!.avg - prevWeek.avg) * 10) / 10, chartType?.unit ?? '')}</b></span>}
              </div>
            )}
            <MetricChart points={chartPoints} unit={chartType?.unit ?? null} phases={phases} />
            <p className="mt-1 text-xs text-muted-foreground">Vạch đứt nét đánh dấu ngày bắt đầu mỗi giai đoạn.</p>
          </>
        ) : <p className="text-sm text-muted-foreground">Chưa có chỉ số dạng số.</p>}
      </section>

      <PhaseComparison metrics={metrics} byMetric={byMetric} phases={phases} />
      <History {...props} />
      {props.showPhotos !== false && <PhotoSection key={props.photos.length} clientId={clientId} clientName={props.clientName} photos={props.photos} phases={phases}
        canEdit={isStaff} consent={props.photoConsent} weights={byMetric.get(metrics.find((m) => m.name === 'Cân nặng')?.id ?? '') ?? []} />}
      {isStaff && <MetricSettings {...props} />}
    </div>
  )
}

// ─── Nhập số đo ─────────────────────────────────────────────────────────────
function EntryForm({ clientId, viewer, metrics, measurements, phases }: Parameters<typeof MetricsView>[0]) {
  const isStaff = viewer === 'staff'
  const editable = metrics.filter((m) => isStaff || m.client_can_enter)
  const today = todayVN()
  const [date, setDate] = useState(today)
  const [values, setValues] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()

  const dates = useMemo(() => [...new Set(measurements.map((m) => m.measured_on))].sort(), [measurements])
  const savedOn = useMemo(() => new Map(measurements.filter((m) => m.measured_on === date)
    .map((m) => [m.metric_type_id, m.value_num !== null ? fmtNum(Number(m.value_num), 2) : (m.value_text ?? '')])), [measurements, date])
  const val = (id: string) => values[id] ?? savedOn.get(id) ?? ''
  const phase = phaseForDate(phases, date)
  const prevDate = [...dates].reverse().find((d) => d < date)
  const nextDate = dates.find((d) => d > date) ?? (date < today ? today : undefined)
  const go = (d?: string) => { if (d) { setDate(d); setValues({}) } }

  if (!editable.length) return null
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">{isStaff ? 'Nhập số đo' : 'Tự nhập cân nặng & số đo vòng'}</h2>
      <div className="mb-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Lần đo trước" disabled={!prevDate} onClick={() => go(prevDate)}><ChevronLeft /></Button>
        <Input type="date" max={today} value={date} onChange={(e) => go(e.target.value)} className="flex-1" aria-label="Ngày đo" />
        <Button type="button" variant="outline" size="icon" aria-label="Lần đo sau" disabled={!nextDate} onClick={() => go(nextDate)}><ChevronRight /></Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {formatDate(date)} · {phase ? <>Giai đoạn: <b className="text-foreground">{phase.name}</b></> : 'Chưa có giai đoạn'}
        {savedOn.size > 0 && ' · đã có số đo ngày này, sửa rồi bấm Lưu'}
      </p>
      <form onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveMeasurements(clientId, date, editable.map((m) => ({ metric_type_id: m.id, value: val(m.id) })))
          if (r.ok) { toast.success('Đã lưu số đo.'); setValues({}) } else toast.error(r.error)
        })
      }}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {editable.map((m) => (
            <Field key={m.id} label={`${m.name}${m.unit ? ` (${m.unit})` : ''}`} htmlFor={`m-${m.id}`} className={m.kind === 'text' ? 'col-span-2 md:col-span-3' : ''}>
              {m.kind === 'number'
                ? <Input id={`m-${m.id}`} type="text" inputMode="decimal" placeholder="—" value={val(m.id)}
                    onChange={(e) => setValues({ ...values, [m.id]: cleanDecimalInput(e.target.value) })} />
                : <Input id={`m-${m.id}`} placeholder="Ghi chú…" value={val(m.id)} onChange={(e) => setValues({ ...values, [m.id]: e.target.value })} />}
            </Field>
          ))}
        </div>
        <Button type="submit" size="lg" className="mt-4 w-full" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu số đo'}</Button>
      </form>
    </section>
  )
}

// ─── So sánh đầu / cuối giai đoạn ───────────────────────────────────────────
function PhaseComparison({ metrics, byMetric, phases }: { metrics: MetricType[]; byMetric: Map<string, Measurement[]>; phases: PhaseLite[] }) {
  const numeric = metrics.filter((m) => m.kind === 'number')
  const rows = phases.map((p) => ({
    phase: p,
    items: numeric.map((m) => {
      const list = (byMetric.get(m.id) ?? []).filter((x) => x.phase_id === p.id && x.value_num !== null)
      if (!list.length) return null
      const first = list[0], last = list[list.length - 1]
      return { m, first, last, delta: Math.round((Number(last.value_num) - Number(first.value_num)) * 10) / 10 }
    }).filter((x) => x !== null),
  })).filter((r) => r.items.length)
  if (!rows.length) return null

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">So sánh đầu – cuối giai đoạn</h2>
      <div className="space-y-5">
        {rows.map(({ phase, items }) => (
          <div key={phase.id}>
            <p className="mb-2 font-semibold">{phase.name}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1.5 font-medium">Chỉ số</th><th className="py-1.5 text-right font-medium">Đầu</th><th className="py-1.5 text-right font-medium">Cuối</th><th className="py-1.5 text-right font-medium">Thay đổi</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(({ m, first, last, delta }) => (
                    <tr key={m.id}>
                      <td className="py-2">{m.name}</td>
                      <td className="py-2 text-right">{fmtNum(Number(first.value_num))}<span className="block text-[11px] text-muted-foreground">{formatDate(first.measured_on)}</span></td>
                      <td className="py-2 text-right">{fmtNum(Number(last.value_num))}<span className="block text-[11px] text-muted-foreground">{formatDate(last.measured_on)}</span></td>
                      <td className="py-2 text-right font-semibold">{first.id === last.id ? '—' : fmtDelta(delta, m.unit ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Lịch sử đo dạng bảng ───────────────────────────────────────────────────
function History({ clientId, viewer, metrics, measurements, phases, canEnter }: Parameters<typeof MetricsView>[0]) {
  const [pending, start] = useTransition()
  const dates = [...new Set(measurements.map((m) => m.measured_on))].sort().reverse()
  const paged = usePaged(dates, 10)
  if (!dates.length) return null
  const shown = paged.pageItems
  const cell = new Map(measurements.map((m) => [`${m.measured_on}|${m.metric_type_id}`, m]))
  const cols = metrics.filter((m) => measurements.some((x) => x.metric_type_id === m.id))
  const phaseName = new Map(phases.map((p) => [p.id, p.name]))

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">Lịch sử đo ({dates.length} lần)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="sticky left-0 bg-card py-2 pr-3 font-medium">Ngày</th>
              {cols.map((m) => <th key={m.id} className="whitespace-nowrap px-2 py-2 text-right font-medium">{m.name}{m.unit ? ` (${m.unit})` : ''}</th>)}
              <th className="px-2 py-2 font-medium">Người nhập</th><th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((d) => {
              const rows = measurements.filter((m) => m.measured_on === d)
              const byClient = rows.some((r) => r.source === 'client')
              const byStaff = rows.some((r) => r.source === 'staff')
              const pid = rows.find((r) => r.phase_id)?.phase_id
              return (
                <tr key={d}>
                  <td className="sticky left-0 whitespace-nowrap bg-card py-2 pr-3">
                    <span className="font-semibold">{formatDate(d)}</span>
                    {pid && <span className="block text-[11px] text-muted-foreground">{phaseName.get(pid)}</span>}
                  </td>
                  {cols.map((m) => {
                    const v = cell.get(`${d}|${m.id}`)
                    return <td key={m.id} className="max-w-48 px-2 py-2 text-right">{v ? (v.value_num !== null ? fmtNum(Number(v.value_num), 2) : v.value_text) : <span className="text-muted-foreground">—</span>}</td>
                  })}
                  <td className="whitespace-nowrap px-2 py-2">
                    {byStaff && <Badge variant="secondary">HLV</Badge>} {byClient && <Badge variant="outline">Khách</Badge>}
                  </td>
                  <td className="py-2 text-right">
                    {(viewer === 'staff' || (byClient && canEnter !== false)) && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Xoá số đo ngày ${formatDate(d)}`} disabled={pending}
                        onClick={async () => {
                          if (!(await confirmDialog({ title: `Xoá số đo ngày ${formatDate(d)}?`, description: viewer === 'staff' ? 'Xoá toàn bộ chỉ số đã nhập trong ngày này.' : 'Chỉ xoá các số bạn tự nhập; số do HLV nhập vẫn giữ.', destructive: true }))) return
                          start(async () => { const r = await deleteMeasurementsOn(clientId, d); if (!r.ok) toast.error(r.error) })
                        }}><Trash2 /></Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager paged={paged} label="lần đo" />
    </section>
  )
}

// ─── Cài đặt chỉ số (HLV) ───────────────────────────────────────────────────
function MetricSettings({ clientId, metrics, optional, enabled }: Parameters<typeof MetricsView>[0]) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', unit: '', kind: 'number' as 'number' | 'text' })
  const custom = metrics.filter((m) => m.client_id)

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">Cài đặt chỉ số</h2>
      {optional.length > 0 && (
        <div className="mb-4 space-y-1">
          <p className="text-xs text-muted-foreground">Chỉ số tuỳ chọn (mặc định tắt):</p>
          {optional.map((m) => (
            <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={enabled.includes(m.id)} disabled={pending}
                onCheckedChange={(v) => start(async () => { const r = await toggleOptionalMetric(clientId, m.id, v === true); if (!r.ok) toast.error(r.error) })} />
              {m.name} {m.unit && <span className="text-muted-foreground">({m.unit})</span>}
            </label>
          ))}
        </div>
      )}
      {custom.length > 0 && (
        <ul className="mb-3 space-y-1">
          {custom.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{m.name} {m.unit && <span className="text-muted-foreground">({m.unit})</span>} <Badge variant="outline">Tuỳ chỉnh</Badge></span>
              <Button size="icon-sm" variant="ghost" aria-label="Xoá chỉ số" disabled={pending}
                onClick={async () => {
                  if (!(await confirmDialog({ title: `Xoá chỉ số "${m.name}"?`, description: 'Toàn bộ số đo của chỉ số này cũng bị xoá.', destructive: true }))) return
                  start(async () => { const r = await deleteCustomMetric(clientId, m.id); if (!r.ok) toast.error(r.error) })
                }}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}><Plus /> Thêm chỉ số tuỳ chỉnh</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await addCustomMetric(clientId, form)
              if (r.ok) { setOpen(false); setForm({ name: '', unit: '', kind: 'number' }); toast.success('Đã thêm chỉ số.') } else toast.error(r.error)
            })
          }}>
            <DialogHeader><DialogTitle>Chỉ số tuỳ chỉnh</DialogTitle></DialogHeader>
            <Field label="Tên chỉ số" htmlFor="cm-name"><Input id="cm-name" required placeholder="Vd: Biên độ gập hông phải" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Kiểu">
              <ChipGroup options={[{ value: 'number', label: 'Số' }, { value: 'text', label: 'Ghi chú' }]} value={[form.kind]} onChange={(v) => setForm({ ...form, kind: v[0] as 'number' | 'text' })} />
            </Field>
            {form.kind === 'number' && <Field label="Đơn vị" htmlFor="cm-unit"><Input id="cm-unit" placeholder="cm, kg, °, lần…" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>}
            <DialogFooter><Button type="submit" disabled={pending}>Thêm</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
