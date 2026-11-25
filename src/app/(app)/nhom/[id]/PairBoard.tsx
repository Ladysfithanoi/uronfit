'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChipGroup } from '@/components/form/Field'
import { Pager, usePaged } from '@/components/ui/pagination'
import { formatDate, todayVN } from '@/lib/date'
import { cleanDecimalInput, fmtDelta, fmtNum } from '@/lib/num'
import type { Measurement, MetricType } from '@/lib/metrics'
import { cn } from '@/lib/utils'
import { saveMeasurements } from '@/app/actions/metrics'

export type PairPerson = {
  id: string; name: string; goals: string[]
  phase: { name: string; start: string; end: string | null } | null
  ownDone: number; ownTotal: number
  metrics: MetricType[]; measurements: Measurement[]
}

// Phân biệt bằng cả màu lẫn kiểu nét (không chỉ dựa vào màu)
const STYLE = [{ color: '#FD3786', dash: undefined }, { color: '#FFFFFF', dash: '6 4' }] as const
const GRID = '#2A2A2A', MUTED = '#A0A0A0'
const round = (n: number) => Math.round(n * 100) / 100
const ts = (d: string) => Date.parse(d + 'T00:00:00Z')
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const has = (p: PairPerson, id: string) => p.metrics.some((m) => m.id === id)
const textOf = (m: Measurement) => (m.value_num !== null ? fmtNum(Number(m.value_num), 2) : (m.value_text ?? ''))

/** Bảng theo dõi song song hai người trong nhóm 1:2 (chỉ HLV xem) */
export function PairBoard({ people }: { people: PairPerson[] }) {
  const rows = useMemo(() => [...new Map(people.flatMap((p) => p.metrics).map((m) => [m.id, m])).values()]
    .sort((a, b) => a.sort_order - b.sort_order), [people])
  // Số đo theo người → chỉ số (đã sắp theo ngày tăng dần)
  const series = useMemo(() => people.map((p) => {
    const m = new Map<string, Measurement[]>()
    for (const x of p.measurements) { const l = m.get(x.metric_type_id); if (l) l.push(x); else m.set(x.metric_type_id, [x]) }
    return m
  }), [people])

  return (
    <div className="mb-8 space-y-4">
      <Progress people={people} />
      <Compare people={people} rows={rows} series={series} />
      <Chart people={people} rows={rows.filter((m) => m.kind === 'number')} series={series} />
      <Entry people={people} rows={rows} />
      <History people={people} rows={rows} />
    </div>
  )
}

type Common = { people: PairPerson[]; rows: MetricType[]; series: Map<string, Measurement[]>[] }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">{title}</h2>
      {children}
    </section>
  )
}

function Progress({ people }: { people: PairPerson[] }) {
  return (
    <Card title="Tiến độ của hai người">
      <div className="grid gap-3 sm:grid-cols-2">
        {people.map((p) => {
          const last = p.measurements.at(-1)?.measured_on
          const pct = p.ownTotal ? Math.round((p.ownDone / p.ownTotal) * 100) : 0
          return (
            <div key={p.id} className="space-y-1 rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold">{p.name}</p>
              <p className="text-muted-foreground">Mục tiêu: {p.goals.join(', ') || '—'}</p>
              <p className="text-muted-foreground">Giai đoạn: {p.phase ? <>{p.phase.name} ({formatDate(p.phase.start)}{p.phase.end && ` – ${formatDate(p.phase.end)}`})</> : 'chưa có'}</p>
              <p className="text-muted-foreground">Đo gần nhất: {last ? formatDate(last) : 'chưa đo'}</p>
              {p.ownTotal > 0 && (
                <>
                  <p className="text-muted-foreground">Giáo án riêng: {p.ownDone}/{p.ownTotal} buổi</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={`Giáo án riêng của ${p.name}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Compare({ people, rows, series }: Common) {
  return (
    <Card title="Bảng chỉ số của hai người">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr>
            <th className="w-[30%] pb-2 text-left font-medium text-muted-foreground">Chỉ số</th>
            {people.map((p) => <th key={p.id} className="truncate px-1 pb-2 text-left font-semibold">{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-border align-top">
              <th scope="row" className="py-2 pr-2 text-left font-normal">{m.name}{m.unit ? ` (${m.unit})` : ''}</th>
              {people.map((p, i) => {
                const l = series[i].get(m.id) ?? []
                const first = l[0], last = l.at(-1)
                if (!has(p, m.id) || !first || !last) return <td key={p.id} className="px-1 py-2 text-muted-foreground">—</td>
                return (
                  <td key={p.id} className="break-words px-1 py-2">
                    <b className="tabular-nums">{textOf(last)}</b>
                    {m.kind === 'number' && l.length > 1 && (
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        Đầu {textOf(first)} · {fmtDelta(round(Number(last.value_num) - Number(first.value_num)))}
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">{formatDate(last.measured_on)}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function Chart({ people, rows, series }: Common) {
  const [metricId, setMetricId] = useState(rows[0]?.id ?? '')
  const [mode, setMode] = useState<'delta' | 'value'>('delta')
  const type = rows.find((m) => m.id === metricId) ?? rows[0]
  if (!type) return null

  const points = new Map<number, Record<string, number>>()
  people.forEach((p, i) => {
    const l = has(p, type.id) ? (series[i].get(type.id) ?? []).filter((x) => x.value_num !== null) : []
    for (const x of l) {
      const t = ts(x.measured_on)
      points.set(t, { ...(points.get(t) ?? { t }), [`p${i}`]: mode === 'delta' ? round(Number(x.value_num) - Number(l[0].value_num)) : Number(x.value_num) })
    }
  })
  const data = [...points.values()].sort((a, b) => a.t - b.t)
  const pad = data.length ? Math.max(86400000 * 2, (data.at(-1)!.t - data[0].t) * 0.04) : 0

  return (
    <Card title="Biểu đồ tiến độ">
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {rows.map((m) => (
          <button key={m.id} type="button" onClick={() => setMetricId(m.id)} aria-pressed={m.id === type.id}
            className={cn('min-h-11 shrink-0 cursor-pointer rounded-full border px-3 text-sm', m.id === type.id ? 'border-brand bg-brand/15' : 'border-border text-muted-foreground')}>
            {m.name}
          </button>
        ))}
      </div>
      <ChipGroup<'delta' | 'value'> options={[{ value: 'delta', label: 'Thay đổi từ lần đầu' }, { value: 'value', label: 'Giá trị đo' }]} value={[mode]} onChange={(v) => setMode(v[0])} />
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {people.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden><line x1="0" y1="4" x2="28" y2="4" stroke={STYLE[i % 2].color} strokeWidth="2" strokeDasharray={STYLE[i % 2].dash} /></svg>
            {p.name}
          </li>
        ))}
      </ul>
      {data.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Chưa có số đo cho chỉ số này.</p> : (
        <div className="mt-2 h-64 w-full" role="img" aria-label={`Biểu đồ ${type.name} của ${people.map((p) => p.name).join(' và ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={[data[0].t - pad, data.at(-1)!.t + pad]} tickFormatter={(t: number) => formatDate(iso(t)).slice(0, 5)}
                stroke={MUTED} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
              <YAxis domain={['auto', 'auto']} width={48} stroke={MUTED} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(v)} />
              <Tooltip cursor={{ stroke: MUTED, strokeDasharray: '3 3' }} contentStyle={{ background: '#000', border: '1px solid #2A2A2A', borderRadius: 10, fontSize: 13 }}
                labelStyle={{ color: MUTED }} itemStyle={{ color: '#fff' }} labelFormatter={(t) => formatDate(iso(Number(t)))}
                formatter={(v, name) => [mode === 'delta' ? fmtDelta(Number(v), type.unit ?? '') : `${fmtNum(Number(v), 2)}${type.unit ? ' ' + type.unit : ''}`, name]} />
              {people.map((p, i) => (
                <Line key={p.id} name={p.name} dataKey={`p${i}`} connectNulls type="monotone" stroke={STYLE[i % 2].color} strokeDasharray={STYLE[i % 2].dash} strokeWidth={2}
                  isAnimationActive={false} dot={{ r: 4, fill: STYLE[i % 2].color, stroke: '#161616', strokeWidth: 2, strokeDasharray: '0' }} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

function Entry({ people, rows }: Omit<Common, 'series'>) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [date, setDate] = useState(todayVN())
  const [values, setValues] = useState<Record<string, string>>({}) // `${clientId}:${metricId}` — chỉ ô đã sửa
  const saved = useMemo(() => new Map<string, string>(people.flatMap((p) => p.measurements.filter((m) => m.measured_on === date).map((m) => [`${p.id}:${m.metric_type_id}`, textOf(m)] as const))), [people, date])

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!Object.keys(values).length) { toast.error('Chưa có số đo nào được nhập.'); return }
    start(async () => {
      const left = { ...values }
      for (const p of people) {
        const keys = Object.keys(values).filter((k) => k.startsWith(`${p.id}:`))
        if (!keys.length) continue
        const r = await saveMeasurements(p.id, date, keys.map((k) => ({ metric_type_id: k.slice(p.id.length + 1), value: values[k] })))
        if (r.ok) { toast.success(`Đã lưu số đo của ${p.name}.`); for (const k of keys) delete left[k] }
        else toast.error(`${p.name}: ${r.error}`)
      }
      setValues(left)
      router.refresh()
    })
  }

  return (
    <Card title="Nhập số đo cho cả hai">
      <form onSubmit={save}>
        <Input type="date" required max={todayVN()} value={date} aria-label="Ngày đo" className="mb-3" disabled={pending}
          onChange={(e) => { setDate(e.target.value); setValues({}) }} />
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr>
              <th className="w-[30%] pb-2 text-left font-medium text-muted-foreground">Chỉ số</th>
              {people.map((p) => <th key={p.id} className="truncate px-1 pb-2 text-left font-semibold">{p.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <th scope="row" className="py-2 pr-2 text-left font-normal">{m.name}{m.unit ? ` (${m.unit})` : ''}</th>
                {people.map((p) => {
                  const k = `${p.id}:${m.id}`
                  return (
                    <td key={p.id} className="px-1 py-2">
                      {has(p, m.id)
                        ? <Input type="text" inputMode={m.kind === 'number' ? 'decimal' : undefined} placeholder="—" disabled={pending} aria-label={`${m.name} — ${p.name}`}
                            value={values[k] ?? saved.get(k) ?? ''}
                            onChange={(e) => setValues({ ...values, [k]: m.kind === 'number' ? cleanDecimalInput(e.target.value) : e.target.value })} />
                        : <span className="px-3 text-muted-foreground">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <Button type="submit" size="lg" className="mt-4 w-full" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu số đo cả hai'}</Button>
      </form>
    </Card>
  )
}

function History({ people, rows }: Omit<Common, 'series'>) {
  const dates = useMemo(() => [...new Set(people.flatMap((p) => p.measurements.map((m) => m.measured_on)))].sort().reverse(), [people])
  const paged = usePaged(dates, 6)
  if (!dates.length) return null
  return (
    <Card title="Lịch sử đo của hai người">
      <ul className="space-y-3">
        {paged.pageItems.map((d) => (
          <li key={d} className="rounded-lg border border-border p-3 text-sm">
            <p className="mb-2 font-semibold">{formatDate(d)}</p>
            <div className="grid grid-cols-2 gap-3">
              {people.map((p) => {
                const ms = p.measurements.filter((m) => m.measured_on === d)
                return (
                  <div key={p.id} className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{p.name}</p>
                    {ms.length === 0 && <p className="text-muted-foreground">Không đo</p>}
                    {ms.map((m) => {
                      const t = rows.find((r) => r.id === m.metric_type_id)
                      return t && <p key={m.id} className="break-words">{t.name}: <b className="tabular-nums">{textOf(m)}</b>{t.unit ? ` ${t.unit}` : ''}</p>
                    })}
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
      <Pager paged={paged} label="ngày đo" />
    </Card>
  )
}
