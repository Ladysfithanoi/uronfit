import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Smartphone } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/labels'
import { PageHeader } from '@/components/layout/PageHeader'
import { LogoutButton } from '@/components/auth/LogoutButton'

export const metadata: Metadata = { title: 'Tài khoản' }

export default async function AccountPage() {
  const me = await requirePageRole()
  return (
    <div className="max-w-lg">
      <PageHeader title="Tài khoản" />
      <dl className="divide-y divide-border rounded-xl border border-border bg-card">
        <Row label="Họ tên" value={me.full_name} />
        <Row label="Email đăng nhập" value={me.email} />
        <Row label="Vai trò" value={ROLE_LABEL[me.role]} />
        {me.phone && <Row label="Số điện thoại" value={me.phone} />}
      </dl>

      <Link href="/thiet-bi"
        className="mt-4 flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 transition-colors hover:bg-secondary">
        <Smartphone className="size-5 text-brand" />
        <span className="flex-1 font-medium">Thiết bị đang đăng nhập</span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <div className="mt-8"><LogoutButton /></div>
    </div>
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
