'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, ChipGroup } from '@/components/form/Field'
import { GOAL_LABEL, HEALTH_FLAG_LABEL } from '@/lib/labels'
import { todayVN } from '@/lib/date'
import { cleanDecimalInput } from '@/lib/num'
import { metricsForClient, type MetricType } from '@/lib/metrics'
import type { PairCandidate } from '@/lib/pairs'
import type { Gender, GoalGroup } from '@/lib/types'
import type { ClientInput } from './actions'

export type PartnerMode = 'new' | 'existing' | 'later'

export const blankPartner = (): ClientInput => ({
  full_name: '', gender: 'female', birth_date: null, phone: '', start_date: todayVN(), goals: [],
  training_type: 'one_on_two', pt_id: null, status: 'active', injuries: '', surgeries: '', joint_conditions: '',
  doctor_orders: '', avoid_movements: '', health_flags: [], is_kid: false, guardian_name: '', guardian_phone: '',
  height_cm: '', kid_notes: '', photo_consent: false, avatar_path: null, tier_id: null,
  package_name: '', package_total: '', package_used: '0',
})

/** Bảng phụ điền thông tin người thứ 2 (hiện khi chọn hình thức 1:2) */
export function PartnerPanel({ mode, onMode, value: f, onChange, candidates, selected, onSelect, tiers }: {
  mode: PartnerMode; onMode: (m: PartnerMode) => void
  value: ClientInput; onChange: (v: ClientInput) => void
  candidates: PairCandidate[]; selected: string; onSelect: (id: string) => void
  tiers: { id: string; name: string; is_default: boolean }[]
}) {
  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => onChange({ ...f, [k]: v })
  const goals = Object.entries(GOAL_LABEL).filter(([k]) => k !== 'kids').map(([value, label]) => ({ value: value as GoalGroup, label }))

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Người thứ 2 có hồ sơ, gói tập và chỉ số riêng; cùng PT và ngày bắt đầu với người thứ 1. App tự lập nhóm 1:2 khi lưu. Hai khách không xem được dữ liệu của nhau.
      </p>
      <ChipGroup<PartnerMode> options={[{ value: 'new', label: 'Người mới' }, { value: 'existing', label: 'Khách có sẵn' }, { value: 'later', label: 'Thêm sau' }]}
        value={[mode]} onChange={(v) => onMode(v[0])} />

      {mode === 'existing' && (candidates.length
        ? (
          <Field label="Chọn khách" htmlFor="p2-pick" hint="Khách đang tập của cùng PT và chưa thuộc nhóm 1:2 nào.">
            <NativeSelect id="p2-pick" value={selected} onChange={(e) => onSelect(e.target.value)}>
              <option value="">— Chọn khách —</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </NativeSelect>
          </Field>
        )
        : <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">Chưa có khách phù hợp (cùng PT, đang tập, chưa thuộc nhóm 1:2). Hãy chọn &quot;Người mới&quot;.</p>)}

      {mode === 'new' && (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <Field label="Họ tên người thứ 2" htmlFor="p2-name"><Input id="p2-name" required value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
          <Field label="Giới tính">
            <ChipGroup<Gender> options={[{ value: 'female', label: 'Nữ' }, { value: 'male', label: 'Nam' }]} value={[f.gender]} onChange={(v) => set('gender', v[0])} />
          </Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Ngày sinh" htmlFor="p2-birth"><Input id="p2-birth" type="date" value={f.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value || null)} /></Field>
            <Field label="Chiều cao (cm)" htmlFor="p2-height"><Input id="p2-height" inputMode="decimal" value={f.height_cm} onChange={(e) => set('height_cm', cleanDecimalInput(e.target.value))} /></Field>
          </div>
          <Field label="Số điện thoại" htmlFor="p2-phone"><Input id="p2-phone" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Nhóm mục tiêu (chọn một hoặc nhiều)">
            <ChipGroup<GoalGroup> multiple options={goals} value={f.goals} onChange={(v) => set('goals', v)} />
          </Field>

          {tiers.length > 0 && (
            <Field label="Gói dịch vụ" htmlFor="p2-tier">
              <NativeSelect id="p2-tier" value={f.tier_id ?? ''} onChange={(e) => set('tier_id', e.target.value || null)}>
                <option value="">— Gói mặc định ({tiers.find((t) => t.is_default)?.name ?? 'đủ tính năng'}) —</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            </Field>
          )}

          <Field label="Tên gói tập" htmlFor="p2-pkg"><Input id="p2-pkg" placeholder="Gói 24 buổi" value={f.package_name} onChange={(e) => set('package_name', e.target.value)} /></Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Tổng số buổi" htmlFor="p2-total"><Input id="p2-total" inputMode="numeric" value={f.package_total} onChange={(e) => set('package_total', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Đã tập" htmlFor="p2-used"><Input id="p2-used" inputMode="numeric" value={f.package_used} onChange={(e) => set('package_used', e.target.value.replace(/\D/g, ''))} /></Field>
          </div>

          <p className="label-caps pt-2">Tiền sử sức khoẻ người thứ 2</p>
          {([['injuries', 'Chấn thương'], ['surgeries', 'Phẫu thuật'], ['joint_conditions', 'Bệnh lý xương khớp'], ['doctor_orders', 'Chỉ định của bác sĩ'], ['avoid_movements', 'Động tác cần tránh']] as const).map(([k, l]) => (
            <Field key={k} label={l} htmlFor={`p2-${k}`}><Textarea id={`p2-${k}`} value={f[k]} onChange={(e) => set(k, e.target.value)} /></Field>
          ))}
          <Field label="Vùng cần cảnh báo khi lên giáo án">
            <ChipGroup multiple options={Object.entries(HEALTH_FLAG_LABEL).map(([value, label]) => ({ value, label }))} value={f.health_flags} onChange={(v) => set('health_flags', v)} />
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Checkbox checked={f.photo_consent} onCheckedChange={(v) => set('photo_consent', v === true)} />
            Người thứ 2 đồng ý cho phòng tập dùng ảnh trước/sau
          </label>
        </div>
      )}
    </>
  )
}

/** Bảng nhập chỉ số ban đầu: mỗi người một cột; ô chỉ mở khi chỉ số thuộc mục tiêu của người đó */
export function PairMetricsFields({ types, people }: {
  types: MetricType[]
  people: { name: string; goals: GoalGroup[]; values: Record<string, string>; onChange: (v: Record<string, string>) => void }[]
}) {
  const sets = people.map((p) => metricsForClient(types, '', p.goals, []).filter((m) => m.kind === 'number'))
  const rows = [...new Map(sets.flat().map((m) => [m.id, m])).values()].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <>
      <p className="text-sm text-muted-foreground">Số đo ngày hôm nay, không bắt buộc. Danh sách thay đổi theo mục tiêu đã chọn của từng người.</p>
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr>
            <th className="w-[34%] pb-2 text-left font-medium text-muted-foreground">Chỉ số</th>
            {people.map((p, i) => <th key={i} className="truncate px-1 pb-2 text-left font-semibold">{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <th scope="row" className="py-2 pr-2 text-left font-normal">{m.name}{m.unit ? ` (${m.unit})` : ''}</th>
              {people.map((p, i) => (
                <td key={i} className="px-1 py-2">
                  {sets[i].some((x) => x.id === m.id)
                    ? <Input type="text" inputMode="decimal" placeholder="—" aria-label={`${m.name} — ${p.name}`} value={p.values[m.id] ?? ''}
                        onChange={(e) => p.onChange({ ...p.values, [m.id]: cleanDecimalInput(e.target.value) })} />
                    : <span className="px-3 text-muted-foreground">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
