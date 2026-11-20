import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Phụ huynh nhiều bé: chọn bé đang xem */
export function KidSwitcher({ clients, activeId, basePath }: { clients: { id: string; full_name: string }[]; activeId: string; basePath: string }) {
  if (clients.length < 2) return null
  return (
    <nav aria-label="Chọn hồ sơ" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {clients.map((c) => (
        <Link key={c.id} href={`/me/chon?be=${c.id}&next=${encodeURIComponent(basePath)}`} prefetch={false} aria-current={c.id === activeId ? 'page' : undefined}
          className={cn('flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium',
            c.id === activeId ? 'border-brand bg-brand/15' : 'border-border text-muted-foreground')}>
          {c.full_name}
        </Link>
      ))}
    </nav>
  )
}
