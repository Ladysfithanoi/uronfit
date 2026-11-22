import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/date'
import { HEALTH_FLAG_LABEL } from '@/lib/labels'
import { fmtNum } from '@/lib/num'
import { tierFor, type Tier } from '@/lib/features'
import type { Client, Package } from '@/lib/clients'
import { AccountsPanel, PackagePanel, DeleteClientButton } from './OverviewClient'

export async function OverviewTab({ client: c, pkg, pkgs, isFm }: { client: Client; pkg: Package | null; pkgs: Package[]; isFm: boolean }) {
  const supabase = await createClient()
  const [{ data: access }, { data: pt }, { data: tiers }] = await Promise.all([
    supabase.from('client_access').select('relation, profiles(id, full_name, email, is_active)').eq('client_id', c.id),
    c.pt_id ? supabase.from('profiles').select('full_name').eq('id', c.pt_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('service_tiers').select('*').order('sort_order'),
  ])
  const tier = tierFor(c.tier_id, (tiers ?? []) as Tier[])
  const accounts = (access ?? []).flatMap((a) => {
    const p = a.profiles as unknown as { id: string; full_name: string; email: string; is_active: boolean } | null
    return p ? [{ ...p, relation: a.relation as 'self' | 'guardian' }] : []
  })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Thông tin">
        <Info label="PT phụ trách" value={pt?.full_name ?? 'Chưa gán'} />
        <Info label="Gói dịch vụ" value={tier ? `${tier.name}${c.tier_id ? '' : ' (mặc định)'}` : 'Đủ tính năng'} />
        <Info label="Ngày sinh" value={formatDate(c.birth_date)} />
        <Info label="Điện thoại" value={c.phone ?? '—'} />
        <Info label="Chiều cao" value={c.height_cm ? `${fmtNum(Number(c.height_cm))} cm` : null} />
        <Info label="Ngày bắt đầu" value={formatDate(c.start_date)} />
        <Info label="Dùng ảnh trước/sau" value={c.photo_consent ? 'Đã đồng ý' : 'Chưa đồng ý'} />
      </Card>

      <PackagePanel clientId={c.id} pkg={pkg} history={pkgs} />

      <Card title="Tiền sử sức khoẻ">
        <Info label="Chấn thương" value={c.injuries} />
        <Info label="Phẫu thuật" value={c.surgeries} />
        <Info label="Bệnh lý xương khớp" value={c.joint_conditions} />
        <Info label="Chỉ định bác sĩ" value={c.doctor_orders} />
        <Info label="Động tác cần tránh" value={c.avoid_movements} />
        <Info label="Vùng cảnh báo" value={c.health_flags.map((f) => HEALTH_FLAG_LABEL[f] ?? f).join(', ') || null} />
      </Card>

      {c.is_kid && (
        <Card title="Trẻ em">
          <Info label="Phụ huynh" value={c.guardian_name} />
          <Info label="SĐT phụ huynh" value={c.guardian_phone} />
          <Info label="Lưu ý" value={c.kid_notes} />
        </Card>
      )}

      <AccountsPanel clientId={c.id} isKid={c.is_kid} accounts={accounts}
        defaultName={c.is_kid ? (c.guardian_name ?? '') : c.full_name} />

      {isFm && <div className="md:col-span-2"><DeleteClientButton clientId={c.id} name={c.full_name} /></div>}
    </div>
  )
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="label-caps mb-3 text-brand">{title}</h2>
      <dl className="space-y-2.5">{children}</dl>
    </section>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line text-sm">{value || '—'}</dd>
    </div>
  )
}
