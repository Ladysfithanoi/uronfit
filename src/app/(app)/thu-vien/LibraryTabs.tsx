import Link from 'next/link'
import { cn } from '@/lib/utils'

export function LibraryTabs({ active }: { active: 'bai-tap' | 'mau' }) {
  return (
    <nav aria-label="Thư viện" className="mb-4 flex gap-1 border-b border-border">
      {([['bai-tap', 'Bài tập', '/thu-vien'], ['mau', 'Mẫu giáo án & thực đơn', '/thu-vien/mau']] as const).map(([k, l, href]) => (
        <Link key={k} href={href} aria-current={active === k ? 'page' : undefined}
          className={cn('flex min-h-11 items-center border-b-2 px-3 text-sm font-medium', active === k ? 'border-brand' : 'border-transparent text-muted-foreground')}>{l}</Link>
      ))}
    </nav>
  )
}
