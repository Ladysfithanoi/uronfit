'use client'

import { Children, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Phân trang phía client. `resetKey` đổi (vd khi đổi bộ lọc / ô tìm kiếm) → tự về trang 1,
 * không cần useEffect.
 */
export function usePaged<T>(items: T[], size: number, resetKey = '', initialPage = 1) {
  const [state, setState] = useState({ key: resetKey, page: initialPage })
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(state.key === resetKey ? state.page : 1, pages)
  return {
    page, pages, total: items.length, size,
    from: items.length ? (page - 1) * size + 1 : 0,
    to: Math.min(page * size, items.length),
    pageItems: items.slice((page - 1) * size, page * size),
    setPage: (p: number) => setState({ key: resetKey, page: Math.min(Math.max(1, p), pages) }),
  }
}

/** Thanh chuyển trang; ẩn khi chỉ có 1 trang */
export function Pager({ paged, label = 'mục', className, onChange }: {
  paged: Pick<ReturnType<typeof usePaged>, 'page' | 'pages' | 'total' | 'from' | 'to' | 'setPage'>
  label?: string; className?: string; onChange?: () => void
}) {
  if (paged.pages <= 1) return null
  const go = (p: number) => { paged.setPage(p); onChange?.() }
  return (
    <nav aria-label="Phân trang" className={cn('no-print mt-4 flex flex-col items-center gap-2', className)}>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={paged.page <= 1} onClick={() => go(paged.page - 1)} aria-label="Trang trước"><ChevronLeft /> Trước</Button>
        <span className="min-w-24 text-center text-sm font-medium tabular-nums">Trang {paged.page}/{paged.pages}</span>
        <Button variant="outline" disabled={paged.page >= paged.pages} onClick={() => go(paged.page + 1)} aria-label="Trang sau">Sau <ChevronRight /></Button>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">Hiển thị {paged.from}–{paged.to} / {paged.total} {label}</p>
    </nav>
  )
}

/** Cuộn lên đầu danh sách sau khi chuyển trang */
export function useScrollTop<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  return { ref, scroll: () => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
}

/**
 * Bọc danh sách render sẵn ở server: <PagedList size={12}>{items.map(...)}</PagedList>.
 * Mỗi phần tử con là một mục.
 */
export function PagedList({ children, size, label, as: Tag = 'ul', className }: {
  children: React.ReactNode; size: number; label?: string; as?: 'ul' | 'div'; className?: string
}) {
  const items = Children.toArray(children)
  const paged = usePaged(items, size)
  const { ref, scroll } = useScrollTop<HTMLDivElement>()
  return (
    <div ref={ref} className="scroll-mt-20">
      <Tag className={className}>{paged.pageItems}</Tag>
      <Pager paged={paged} label={label} onChange={scroll} />
    </div>
  )
}
