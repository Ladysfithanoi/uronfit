'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Field, ChipGroup } from '@/components/form/Field'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'
import { compressImage, randomFileName } from '@/lib/image'
import { CLIENT_STATUS_LABEL, GOAL_LABEL, HEALTH_FLAG_LABEL, TRAINING_TYPE_LABEL } from '@/lib/labels'
import { todayVN } from '@/lib/date'
import type { Client, Package } from '@/lib/clients'
import type { GoalGroup, TrainingType, ClientStatus, Gender } from '@/lib/types'
import { saveClient, setClientAvatar, type ClientInput } from './actions'

export function ClientForm({ client, pkg, pts, isFm, meId }: {
  client?: Client; pkg?: Package | null; pts: { id: string; full_name: string }[]; isFm: boolean; meId: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [avatar, setAvatar] = useState<File | null>(null)
  const [f, setF] = useState<ClientInput>({
    full_name: client?.full_name ?? '', gender: client?.gender ?? 'female', birth_date: client?.birth_date ?? null,
    phone: client?.phone ?? '', start_date: client?.start_date ?? todayVN(), goals: client?.goals ?? [],
    training_type: client?.training_type ?? 'one_on_one', pt_id: client?.pt_id ?? (isFm ? (pts[0]?.id ?? null) : meId),
    status: client?.status ?? 'active', injuries: client?.injuries ?? '', surgeries: client?.surgeries ?? '',
    joint_conditions: client?.joint_conditions ?? '', doctor_orders: client?.doctor_orders ?? '',
    avoid_movements: client?.avoid_movements ?? '', health_flags: client?.health_flags ?? [],
    is_kid: client?.is_kid ?? false, guardian_name: client?.guardian_name ?? '', guardian_phone: client?.guardian_phone ?? '',
    height_cm: client?.height_cm ? String(client.height_cm) : '', kid_notes: client?.kid_notes ?? '',
    photo_consent: client?.photo_consent ?? false, avatar_path: client?.avatar_path ?? null,
    package_name: pkg?.name ?? '', package_total: pkg ? String(pkg.total_sessions) : '', package_used: pkg ? String(pkg.used_sessions) : '0',
  })
  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => setF((p) => ({ ...p, [k]: v }))
  const isKid = f.is_kid || f.goals.includes('kids')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await saveClient(f, client?.id)
      if (!r.ok) { toast.error(r.error); return }
      const id = r.data!.id
      if (avatar) {
        try {
          const blob = await compressImage(avatar)
          const path = `${id}/avatar-${randomFileName()}`
          const { error } = await createClient().storage.from('client-media').upload(path, blob, { contentType: 'image/jpeg' })
          if (error) throw error
          await setClientAvatar(id, path)
        } catch {
          toast.error('Đã lưu hồ sơ nhưng chưa tải được ảnh đại diện.')
        }
      }
      toast.success(client ? 'Đã lưu hồ sơ.' : 'Đã tạo hồ sơ khách.')
      router.push(`/khach-hang/${id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Thông tin cơ bản">
        <Field label="Họ tên" htmlFor="name"><Input id="name" required value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
        <Field label="Giới tính">
          <ChipGroup<Gender> options={[{ value: 'female', label: 'Nữ' }, { value: 'male', label: 'Nam' }]}
            value={[f.gender]} onChange={(v) => set('gender', v[0])} />
        </Field>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Ngày sinh" htmlFor="birth"><Input id="birth" type="date" value={f.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value || null)} /></Field>
          <Field label="Ngày bắt đầu" htmlFor="start"><Input id="start" type="date" required value={f.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Số điện thoại" htmlFor="phone"><Input id="phone" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Chiều cao (cm)" htmlFor="height"><Input id="height" inputMode="decimal" value={f.height_cm} onChange={(e) => set('height_cm', e.target.value)} /></Field>
        </div>
        <Field label="Ảnh đại diện" htmlFor="avatar" hint="Ảnh được nén trên máy trước khi tải lên và lưu ở kho riêng tư.">
          <Input id="avatar" type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
        </Field>
      </Section>

      <Section title="Mục tiêu & hình thức">
        <Field label="Nhóm mục tiêu (chọn một hoặc nhiều)">
          <ChipGroup<GoalGroup> multiple options={Object.entries(GOAL_LABEL).map(([value, label]) => ({ value: value as GoalGroup, label }))}
            value={f.goals} onChange={(v) => set('goals', v)} />
        </Field>
        <Field label="Hình thức tập">
          <ChipGroup<TrainingType> options={Object.entries(TRAINING_TYPE_LABEL).map(([value, label]) => ({ value: value as TrainingType, label }))}
            value={[f.training_type]} onChange={(v) => set('training_type', v[0])} />
        </Field>
        <div className="grid grid-cols-2 items-end gap-3">
          {isFm && (
            <Field label="PT phụ trách" htmlFor="pt">
              <NativeSelect id="pt" value={f.pt_id ?? ''} onChange={(e) => set('pt_id', e.target.value || null)}>
                <option value="">— Chưa gán —</option>
                {pts.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="Trạng thái" htmlFor="status">
            <NativeSelect id="status" value={f.status} onChange={(e) => set('status', e.target.value as ClientStatus)}>
              {Object.entries(CLIENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Field>
        </div>
      </Section>

      <Section title="Gói tập">
        <Field label="Tên gói" htmlFor="pkg-name"><Input id="pkg-name" placeholder="Gói 24 buổi" value={f.package_name} onChange={(e) => set('package_name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tổng số buổi" htmlFor="pkg-total"><Input id="pkg-total" inputMode="numeric" value={f.package_total} onChange={(e) => set('package_total', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Đã tập" htmlFor="pkg-used" hint="Tự cộng khi hoàn thành buổi / điểm danh có mặt.">
            <Input id="pkg-used" inputMode="numeric" value={f.package_used} onChange={(e) => set('package_used', e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
      </Section>

      <Section title="Tiền sử sức khoẻ">
        <Field label="Chấn thương" htmlFor="inj"><Textarea id="inj" value={f.injuries} onChange={(e) => set('injuries', e.target.value)} /></Field>
        <Field label="Phẫu thuật" htmlFor="sur"><Textarea id="sur" value={f.surgeries} onChange={(e) => set('surgeries', e.target.value)} /></Field>
        <Field label="Bệnh lý xương khớp" htmlFor="joint"><Textarea id="joint" value={f.joint_conditions} onChange={(e) => set('joint_conditions', e.target.value)} /></Field>
        <Field label="Chỉ định của bác sĩ" htmlFor="doc"><Textarea id="doc" value={f.doctor_orders} onChange={(e) => set('doctor_orders', e.target.value)} /></Field>
        <Field label="Động tác cần tránh" htmlFor="avoid"><Textarea id="avoid" value={f.avoid_movements} onChange={(e) => set('avoid_movements', e.target.value)} /></Field>
        <Field label="Vùng cần cảnh báo khi lên giáo án" hint="Bài tập có chống chỉ định trùng vùng này sẽ hiện cảnh báo khi thêm vào giáo án.">
          <ChipGroup multiple options={Object.entries(HEALTH_FLAG_LABEL).map(([value, label]) => ({ value, label }))}
            value={f.health_flags} onChange={(v) => set('health_flags', v)} />
        </Field>
      </Section>

      {isKid && (
        <Section title="Trẻ em">
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Tên phụ huynh" htmlFor="gname"><Input id="gname" value={f.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} /></Field>
            <Field label="SĐT phụ huynh" htmlFor="gphone"><Input id="gphone" inputMode="tel" value={f.guardian_phone} onChange={(e) => set('guardian_phone', e.target.value)} /></Field>
          </div>
          <Field label="Lưu ý riêng" htmlFor="kidnotes"><Textarea id="kidnotes" value={f.kid_notes} onChange={(e) => set('kid_notes', e.target.value)} /></Field>
        </Section>
      )}

      <Section title="Quyền riêng tư">
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <Checkbox checked={f.photo_consent} onCheckedChange={(v) => set('photo_consent', v === true)} className="mt-0.5" />
          <span className="text-sm">
            Khách {isKid && '(phụ huynh) '}đồng ý cho phòng tập dùng ảnh trước/sau
            <span className="block text-xs text-muted-foreground">Chỉ khi bật mới tải được ảnh ghép Trước/Sau.</span>
          </span>
        </label>
      </Section>

      <div className="no-print sticky bottom-20 z-10 grid grid-cols-[auto_1fr] gap-2 md:bottom-4">
        <Button type="button" variant="secondary" size="lg" className="shadow-lg" disabled={pending} onClick={() => router.back()}>Huỷ</Button>
        <Button type="submit" size="lg" className="shadow-lg" disabled={pending}>
          {pending ? 'Đang lưu…' : client ? 'Lưu hồ sơ' : 'Tạo hồ sơ khách'}
        </Button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps text-brand">{title}</h2>
      {children}
    </section>
  )
}
