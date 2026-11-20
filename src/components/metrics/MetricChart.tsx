'use client'

import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatDate } from '@/lib/date'
import { fmtNum } from '@/lib/num'

const BRAND = '#FD3786'
const GRID = '#2A2A2A'
const MUTED = '#A0A0A0'

const ts = (d: string) => Date.parse(d + 'T00:00:00Z')
const dm = (t: number) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}` }

/**
 * Biểu đồ đường một chỉ số theo thời gian, có vạch phân cách giữa các giai đoạn.
 * Một chuỗi dữ liệu → không cần chú thích; tên chỉ số nằm ở tiêu đề phía trên.
 */
export function MetricChart({ points, unit, phases }: {
  points: { date: string; value: number }[]
  unit: string | null
  phases: { id: string; name: string; start_date: string }[]
}) {
  if (points.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có số đo cho chỉ số này.</p>
  const data = points.map((p) => ({ t: ts(p.date), v: p.value, date: p.date }))
  const min = Math.min(...data.map((d) => d.t)), max = Math.max(...data.map((d) => d.t))
  const pad = Math.max(86400000 * 2, (max - min) * 0.04)
  const values = data.map((d) => d.v)
  const vmin = Math.min(...values), vmax = Math.max(...values)
  const vpad = Math.max(0.5, (vmax - vmin) * 0.15)
  const lines = phases.map((p) => ({ ...p, t: ts(p.start_date) })).filter((p) => p.t > min - pad && p.t <= max + pad)

  return (
    <div className="h-64 w-full" role="img" aria-label={`Biểu đồ ${points.length} lần đo`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 24, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={[min - pad, max + pad]} tickFormatter={dm}
            stroke={MUTED} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis domain={[Math.floor((vmin - vpad) * 10) / 10, Math.ceil((vmax + vpad) * 10) / 10]} width={48}
            stroke={MUTED} tick={{ fill: MUTED, fontSize: 12 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => fmtNum(v)} />
          {lines.map((p) => (
            <ReferenceLine key={p.id} x={p.t} stroke={MUTED} strokeDasharray="4 4" strokeOpacity={0.7}
              label={{ value: p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name, position: 'insideTopLeft', fill: MUTED, fontSize: 11, offset: 6 }} />
          ))}
          <Tooltip
            cursor={{ stroke: MUTED, strokeDasharray: '3 3' }}
            contentStyle={{ background: '#000', border: '1px solid #2A2A2A', borderRadius: 10, fontSize: 13 }}
            labelStyle={{ color: MUTED }}
            itemStyle={{ color: '#fff' }}
            labelFormatter={(t) => formatDate(new Date(Number(t)).toISOString().slice(0, 10))}
            formatter={(v) => [`${fmtNum(Number(v))}${unit ? ' ' + unit : ''}`, 'Giá trị']}
          />
          <Line type="monotone" dataKey="v" stroke={BRAND} strokeWidth={2} isAnimationActive={false}
            dot={{ r: 4, fill: BRAND, stroke: '#161616', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: BRAND, stroke: '#161616', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
