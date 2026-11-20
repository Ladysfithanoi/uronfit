'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/app-dialog'
import { cn } from '@/lib/utils'

/**
 * variant "full": nút to ở trang Tài khoản
 * variant "icon": nút biểu tượng ở thanh trên cùng (điện thoại)
 * variant "side": dòng trong thanh bên (máy tính)
 */
export function LogoutButton({ variant = 'full' }: { variant?: 'full' | 'icon' | 'side' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function logout() {
    if (variant !== 'full' && !(await confirmDialog({
      title: 'Đăng xuất?', description: 'Lần sau vào lại trên máy này cần nhập mã gửi qua email.', confirmLabel: 'Đăng xuất',
    }))) return
    setBusy(true)
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    router.replace('/login')
    router.refresh()
  }

  if (variant === 'icon') {
    return <Button variant="ghost" size="icon" aria-label="Đăng xuất" disabled={busy} onClick={logout}><LogOut /></Button>
  }
  if (variant === 'side') {
    return (
      <button type="button" disabled={busy} onClick={logout}
        className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground')}>
        <LogOut className="size-5" /> {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>
    )
  }
  return (
    <Button variant="destructive" size="lg" className="w-full" disabled={busy} onClick={logout}>
      <LogOut /> {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
    </Button>
  )
}
