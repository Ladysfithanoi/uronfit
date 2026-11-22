import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Dumbbell, Utensils, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { portalContext, sharedPlanIds } from '@/lib/portal'
import { loadSessions, planProgress } from '@/lib/plans'
import { activePackage, currentPhase, type Package } from '@/lib/clients'
import { formatDate, todayVN } from '@/lib/date'
import { sortMeals, todayDayNumber, type Meal } from '@/lib/meals'
import { PageHeader } from '@/components/layout/PageHeader'
import { KidSwitcher } from '@/components/portal/KidSwitcher'
import { ProgressBar } from '@/components/plans/ProgressBar'
import { exerciseLine } from '@/components/plans/format'

export const metadata: Metadata = { title: 'Trang chủ' }

export default async function ClientHome() {
  const { me, clients, client, phases, tier, features } = await portalContext()
  if (!client) {
    return <><PageHeader title={`Xin chào, ${me.full_name}`} /><p className="text-sm text-muted-foreground">Chưa có hồ sơ nào được gắn với tài khoản này. Vui lòng liên hệ HLV.</p></>
  }
  const supabase = await createClient()
  const today = todayVN()
  const phase = currentPhase(phases, today)
  const plans = await sharedPlanIds(client.id, phases.map((p) => p.id))
  const sessionsByPlan = await loadSessions(plans.map((p) => p.id))
  const curPlans = plans.filter((p) => !p.phase_id || p.phase_id === phase?.id)
  const allSessions = curPlans.flatMap((p) => sessionsByPlan.get(p.id) ?? [])
  const next = allSessions.find((s) => !s.completed_at && !s.attendance.some((a) => a.client_id === client.id && a.present))
  const nextPlan = next ? curPlans.find((p) => (sessionsByPlan.get(p.id) ?? []).some((s) => s.id === next.id)) : null
  const nextExercises = next ? next.exercises.filter((e) => !e.client_id || e.client_id === client.id).filter((e, _, arr) => e.client_id || !arr.some((x) => x.replaces_id === e.id)) : []

  const [{ data: mealPlan }, { data: pkgs }, { data: notes }] = await Promise.all([
    phase ? supabase.from('meal_plans').select('id, name, kcal, shared_at').eq('phase_id', phase.id).not('shared_at', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('client_packages').select('*').eq('client_id', client.id),
    supabase.from('notes').select('id, content, created_at').eq('client_id', client.id).eq('coach_only', false).order('created_at', { ascending: false }).limit(3),
  ])
  let todayMeals: Meal[] = []
  let dayNo = 1
  if (mealPlan) {
    const { data: meals } = await supabase.from('meals').select('id, day_number, meal_slot, dish, portion, kcal, notes, sort_order').eq('meal_plan_id', mealPlan.id)
    const days = [...new Set((meals ?? []).map((m) => m.day_number))].length
    dayNo = todayDayNumber(days, phase?.start_date ?? today, today)
    todayMeals = sortMeals(((meals ?? []) as Meal[]).filter((m) => m.day_number === dayNo))
  }
  const pkg = activePackage(pkgs as Package[])
  const left = pkg ? pkg.total_sessions - pkg.used_sessions : null
  const prog = planProgress(allSessions)

  return (
    <>
      <PageHeader eyebrow={`${me.role === 'guardian' ? 'Phụ huynh' : 'Khách hàng'}${tier ? ` · Gói ${tier.name}` : ''}`} title={me.role === 'guardian' ? client.full_name : `Xin chào, ${me.full_name}`} />
      <KidSwitcher clients={clients} activeId={client.id} basePath="/me" />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-brand bg-card p-4">
          <p className="label-caps text-brand">Giai đoạn hiện tại</p>
          {phase ? (
            <>
              <p className="mt-1 text-lg font-bold">{phase.name}</p>
              <p className="text-xs text-muted-foreground">{formatDate(phase.start_date)} – {phase.end_date ? formatDate(phase.end_date) : 'chưa định'}</p>
              {phase.targets && <p className="mt-2 text-sm"><span className="text-muted-foreground">Chỉ tiêu:</span> {phase.targets}</p>}
            </>
          ) : <p className="mt-1 text-sm text-muted-foreground">HLV chưa lập lộ trình.</p>}
          {allSessions.length > 0 && <ProgressBar done={prog.done} total={prog.total} className="mt-4" />}
          {left !== null && <p className={`mt-3 text-sm ${left <= 3 ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>Gói tập còn {left} buổi</p>}
        </section>

        {features.has('workout_view') && <section className="rounded-xl border border-border bg-card p-4">
          <p className="label-caps flex items-center gap-1.5"><Dumbbell className="size-4 text-brand" /> Buổi tập kế tiếp</p>
          {next ? (
            <>
              <p className="mt-1 font-semibold">{next.title || `Buổi ${next.day_order}`} <span className="text-sm font-normal text-muted-foreground">· Tuần {next.week}{next.scheduled_date && ` · ${formatDate(next.scheduled_date)}`}</span></p>
              {nextPlan && <p className="text-xs text-muted-foreground">{nextPlan.name}</p>}
              <ul className="mt-2 space-y-1 text-sm">
                {nextExercises.slice(0, 5).map((e) => <li key={e.id}>• {e.exercise.name} <span className="text-muted-foreground">— {exerciseLine(e)}</span></li>)}
                {nextExercises.length > 5 && <li className="text-muted-foreground">+ {nextExercises.length - 5} bài nữa</li>}
              </ul>
              <Link href="/me/giao-an" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">Xem giáo án <ChevronRight className="size-4" /></Link>
            </>
          ) : <p className="mt-1 text-sm text-muted-foreground">{plans.length ? 'Đã hoàn thành mọi buổi trong giáo án hiện tại.' : 'HLV chưa chia sẻ giáo án.'}</p>}
        </section>}

        {features.has('meal_view') && <section className="rounded-xl border border-border bg-card p-4 md:col-span-2">
          <p className="label-caps flex items-center gap-1.5"><Utensils className="size-4 text-brand" /> Thực đơn hôm nay {mealPlan && <span className="normal-case tracking-normal">· Ngày {dayNo}</span>}</p>
          {mealPlan ? (
            <>
              {todayMeals.length ? (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {todayMeals.map((m) => (
                    <li key={m.id} className="flex gap-3 py-2"><span className="w-20 shrink-0 text-muted-foreground">{m.meal_slot}</span><span className="flex-1">{m.dish}{m.portion && <span className="text-muted-foreground"> · {m.portion}</span>}</span>{m.kcal !== null && <span className="shrink-0">{m.kcal} kcal</span>}</li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-muted-foreground">Chưa có món cho hôm nay.</p>}
              <Link href="/me/thuc-don" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">Xem cả thực đơn <ChevronRight className="size-4" /></Link>
            </>
          ) : <p className="mt-1 text-sm text-muted-foreground">HLV chưa chia sẻ thực đơn.</p>}
        </section>}

        {features.has('coach_notes') && notes && notes.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4 md:col-span-2">
            <p className="label-caps flex items-center gap-1.5"><MessageSquare className="size-4 text-brand" /> Lời nhắn từ HLV</p>
            <ul className="mt-2 space-y-2 text-sm">{notes.map((n) => <li key={n.id} className="whitespace-pre-line"><span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span><br />{n.content}</li>)}</ul>
          </section>
        )}
      </div>
    </>
  )
}
