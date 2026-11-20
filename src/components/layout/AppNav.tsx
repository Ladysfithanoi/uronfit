'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarCheck, ChartLine, CircleUser, Dumbbell, House, LayoutDashboard,
  UserCog, Users, UsersRound, Utensils, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

type Item = { href: string; label: string; icon: LucideIcon }

const NAV: Record<UserRole, Item[]> = {
  fm: [
    { href: '/fm', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/khach-hang', label: 'Khách hàng', icon: Users },
    { href: '/thu-vien', label: 'Thư viện', icon: Dumbbell },
    { href: '/fm/nhan-su', label: 'Nhân sự', icon: UserCog },
    { href: '/tai-khoan', label: 'Tài khoản', icon: CircleUser },
  ],
  pt: [
    { href: '/pt', label: 'Hôm nay', icon: CalendarCheck },
    { href: '/khach-hang', label: 'Khách', icon: Users },
    { href: '/nhom', label: 'Nhóm', icon: UsersRound },
    { href: '/thu-vien', label: 'Thư viện', icon: Dumbbell },
    { href: '/tai-khoan', label: 'Tài khoản', icon: CircleUser },
  ],
  client: [
    { href: '/me', label: 'Trang chủ', icon: House },
    { href: '/me/giao-an', label: 'Giáo án', icon: Dumbbell },
    { href: '/me/thuc-don', label: 'Thực đơn', icon: Utensils },
    { href: '/me/chi-so', label: 'Chỉ số', icon: ChartLine },
    { href: '/tai-khoan', label: 'Tài khoản', icon: CircleUser },
  ],
  guardian: [],
}
NAV.guardian = NAV.client

function useActive() {
  const path = usePathname()
  return (href: string) =>
    href === '/fm' || href === '/pt' || href === '/me'
      ? path === href
      : path === href || path.startsWith(href + '/') || (href === '/tai-khoan' && path === '/thiet-bi') ||
        (href === '/khach-hang' && (path.startsWith('/giao-an') || path.startsWith('/thuc-don')))
}

/** Thanh điều hướng dưới đáy (điện thoại) */
export function BottomNav({ role }: { role: UserRole }) {
  const isActive = useActive()
  return (
    <nav aria-label="Điều hướng chính"
      className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-black/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV[role].map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? 'page' : undefined}
                className={cn('flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  active ? 'text-brand' : 'text-muted-foreground')}>
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Thanh bên (máy tính) */
export function SideNav({ role }: { role: UserRole }) {
  const isActive = useActive()
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
      {NAV[role].map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
            <Icon className={cn('size-5', active && 'text-brand')} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
