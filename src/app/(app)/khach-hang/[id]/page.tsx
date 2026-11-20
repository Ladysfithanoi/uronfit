import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Pencil, TriangleAlert } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { signedUrls } from '@/lib/storage'
import { CLIENT_COLUMNS, activePackage, ageFrom, type Client, type Package, type Phase } from '@/lib/clients'
import { CLIENT_STATUS_LABEL, GOAL_LABEL, TRAINING_TYPE_LABEL } from '@/lib/labels'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OverviewTab } from './tabs/OverviewTab'
import { RoadmapTab } from './tabs/RoadmapTab'
import { NotesTab } from './tabs/NotesTab'
import { MetricsTab } from './tabs/MetricsTab'
import { WorkoutTab } from './tabs/WorkoutTab'
import { MealTab } from './tabs/MealTab'

// Tạo lịch tập / thực đơn bằng AI có thể mất 20–40 giây (Vercel cho tối đa 60 giây)
export const maxDuration = 60

export const metadata: Metadata = { title: 'Hồ sơ khách' }

const TABS = [
  ['tong-quan', 'Tổng quan'], ['lo-trinh', 'Lộ trình'], ['giao-an', 'Giáo án'],
  ['thuc-don', 'Thực đơn'], ['chi-so', 'Chỉ số'], ['ghi-chu', 'Ghi chú'],
] as const
type Tab = (typeof TABS)[number][0]

export default async function ClientPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }>
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams])
  const tab: Tab = (TABS.find(([k]) => k === rawTab)?.[0] ?? 'tong-quan')
  const me = await requirePageRole('fm', 'pt')
  const supabase = await createClient()

  const [{ data: client }, { data: pkgs }, { data: phases }] = await Promise.all([
    supabase.from('clients').select(CLIENT_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('client_packages').select('*').eq('client_id', id).order('start_date', { ascending: false }),
    supabase.from('phases').select('*').eq('client_id', id).order('sort_order'),
  ])
  if (!client) notFound()
  const c = client as Client
  const pkg = activePackage(pkgs as Package[])
  const left = pkg ? pkg.total_sessions - pkg.used_sessions : null
  const avatar = (await signedUrls('client-media', [c.avatar_path])).get(c.avatar_path ?? '')
  const age = ageFrom(c.birth_date)

  return (
    <>
      <div className="mb-5 flex items-start gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-full border border-border bg-secondary">
          {avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatar} alt="" className="size-full object-cover" />
            : <div className="flex size-full items-center justify-center text-xl font-bold text-muted-foreground">{c.full_name.split(' ').pop()?.[0]}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight md:text-2xl">{c.full_name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {c.gender === 'female' ? 'Nữ' : 'Nam'}{age !== null && ` · ${age} tuổi`} · {TRAINING_TYPE_LABEL[c.training_type]} · {CLIENT_STATUS_LABEL[c.status]}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {c.goals.map((g) => <Badge key={g} variant="secondary">{GOAL_LABEL[g]}</Badge>)}
            {c.health_flags.length > 0 && <Badge variant="destructive"><TriangleAlert /> Có tiền sử</Badge>}
          </div>
        </div>
        <Link href={`/khach-hang/${id}/sua`} className={buttonVariants({ variant: 'outline', size: 'icon' })} aria-label="Sửa hồ sơ"><Pencil /></Link>
      </div>

      {left !== null && left <= 3 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <span className="font-semibold text-warning">Còn {left} buổi</span>
          <span className="text-muted-foreground"> trong {pkg!.name}. Nhắc khách gia hạn.</span>
        </div>
      )}

      <nav aria-label="Mục hồ sơ" className="no-print -mx-4 mb-5 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map(([k, label]) => (
            <li key={k}>
              <Link href={`/khach-hang/${id}?tab=${k}`} scroll={false} aria-current={tab === k ? 'page' : undefined}
                className={cn('flex min-h-11 items-center border-b-2 px-3 text-sm font-medium',
                  tab === k ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'tong-quan' && <OverviewTab client={c} pkg={pkg} pkgs={(pkgs ?? []) as Package[]} isFm={me.role === 'fm'} />}
      {tab === 'lo-trinh' && <RoadmapTab clientId={id} phases={(phases ?? []) as Phase[]} />}
      {tab === 'giao-an' && <WorkoutTab client={c} phases={(phases ?? []) as Phase[]} />}
      {tab === 'thuc-don' && <MealTab client={c} phases={(phases ?? []) as Phase[]} />}
      {tab === 'chi-so' && <MetricsTab client={c} phases={(phases ?? []) as Phase[]} viewer="staff" />}
      {tab === 'ghi-chu' && <NotesTab clientId={id} />}
    </>
  )
}
