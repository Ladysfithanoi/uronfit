import Image from 'next/image'
import Link from 'next/link'
import { requirePageRole } from '@/lib/auth'
import { ROLE_LABEL, homePath } from '@/lib/labels'
import { BottomNav, SideNav } from '@/components/layout/AppNav'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { portalContext } from '@/lib/portal'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePageRole()
  // Khách / phụ huynh: menu chỉ hiện tính năng có trong gói dịch vụ của hồ sơ đang xem
  const features = me.role === 'client' || me.role === 'guardian' ? [...(await portalContext()).features] : undefined

  return (
    <div className="min-h-dvh md:flex">
      {/* Máy tính: thanh bên */}
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <Link href={homePath(me.role)} className="mb-6 flex items-center gap-3 px-2">
          <Image src="/brand/logo.svg" alt="UR Private Gym" width={44} height={44} />
          <span className="text-xs font-bold uppercase tracking-[0.14em]">Private Gym</span>
        </Link>
        <SideNav role={me.role} features={features} />
        <div className="mt-auto space-y-3">
          <div className="px-2 text-sm">
            <p className="truncate font-semibold">{me.full_name}</p>
            <p className="label-caps mt-1">{ROLE_LABEL[me.role]}</p>
          </div>
          <LogoutButton variant="side" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Điện thoại: thanh trên */}
        <header className="no-print pt-safe sticky top-0 z-30 border-b border-border bg-black/95 backdrop-blur md:hidden">
          <div className="flex h-14 items-center gap-3 px-4">
            <Link href={homePath(me.role)} aria-label="Trang chủ">
              <Image src="/brand/logo.svg" alt="UR Private Gym" width={36} height={36} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{me.full_name}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{ROLE_LABEL[me.role]}</p>
            </div>
            <LogoutButton variant="icon" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>
      </div>

      <BottomNav role={me.role} features={features} />
    </div>
  )
}
