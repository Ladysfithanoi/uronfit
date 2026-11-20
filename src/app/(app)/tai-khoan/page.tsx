import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Smartphone } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/labels'
import { PageHeader } from '@/components/layout/PageHeader'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { AccountEditor } from './AccountEditor'

export const metadata: Metadata = { title: 'Tài khoản' }

export default async function AccountPage() {
  const me = await requirePageRole()
  return (
    <div className="max-w-lg">
      <PageHeader title="Tài khoản" />
      <AccountEditor me={{
        full_name: me.full_name, email: me.email, phone: me.phone,
        roleLabel: ROLE_LABEL[me.role], canChangeEmail: me.role === 'fm',
      }} />

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
