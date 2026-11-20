import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { NewPlanDialog } from '@/components/plans/NewPlanDialog'
import { LibraryTabs } from '../LibraryTabs'
import { PagedList } from '@/components/ui/pagination'

export const metadata: Metadata = { title: 'Mẫu giáo án & thực đơn' }

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ loai?: string }> }) {
  const { loai } = await searchParams
  const meal = loai === 'thuc-don'
  await requirePageRole('fm', 'pt')
  const supabase = await createClient()
  const { data } = meal
    ? await supabase.from('meal_plans').select('id, name, kcal, profiles(full_name)').eq('is_template', true).order('name')
    : await supabase.from('workout_plans').select('id, name, profiles(full_name), workout_sessions(id)').eq('is_template', true).order('name')
  const items = (data ?? []) as unknown as { id: string; name: string; kcal?: number | null; profiles: { full_name: string } | null; workout_sessions?: { id: string }[] }[]

  return (
    <>
      <PageHeader eyebrow="Thư viện" title="Mẫu" description="Lưu giáo án / thực đơn thành mẫu để dùng lại và nhân bản cho khách khác." />
      <LibraryTabs active="mau" />
      <div className="mb-4 flex gap-2">
        <Link href="/thu-vien/mau" className={`flex min-h-11 items-center rounded-full border px-4 text-sm ${!meal ? 'border-brand bg-brand/15' : 'border-border text-muted-foreground'}`}>Giáo án</Link>
        <Link href="/thu-vien/mau?loai=thuc-don" className={`flex min-h-11 items-center rounded-full border px-4 text-sm ${meal ? 'border-brand bg-brand/15' : 'border-border text-muted-foreground'}`}>Thực đơn</Link>
        <div className="ml-auto"><NewPlanDialog kind={meal ? 'meal' : 'workout'} isTemplate templates={[]} label="Mẫu mới" /></div>
      </div>
      <PagedList size={12} label="mẫu" className="grid gap-2 md:grid-cols-2">
        {items.map((t) => (
          <li key={t.id}>
            <Link href={meal ? `/thuc-don/${t.id}` : `/giao-an/${t.id}`} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-card p-4 hover:bg-secondary">
              <span className="flex-1">
                <span className="block font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {meal ? (t.kcal ? `${t.kcal} kcal/ngày` : 'Chưa đặt calo') : `${t.workout_sessions?.length ?? 0} buổi`} · {t.profiles?.full_name ?? '—'}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </PagedList>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Chưa có mẫu. Mở một giáo án/thực đơn → ⋯ → Lưu thành mẫu.</p>}
    </>
  )
}
