import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { portalContext } from '@/lib/portal'
import { PageHeader } from '@/components/layout/PageHeader'
import { KidSwitcher } from '@/components/portal/KidSwitcher'
import { FeatureLocked } from '@/components/portal/FeatureLocked'
import { MealPlanViewer } from '@/components/meals/MealPlanViewer'
import { currentPhase } from '@/lib/clients'
import { todayVN } from '@/lib/date'
import { todayDayNumber, type Meal, type MealPlan } from '@/lib/meals'

export const metadata: Metadata = { title: 'Thực đơn' }

export default async function MyMealsPage() {
  const { clients, client, phases, tier, features } = await portalContext()
  if (!client) return <PageHeader title="Thực đơn" description="Chưa có hồ sơ." />
  if (!features.has('meal_view')) {
    return <><PageHeader title="Thực đơn" /><KidSwitcher clients={clients} activeId={client.id} basePath="/me/thuc-don" /><FeatureLocked feature="Xem thực đơn" tierName={tier?.name} /></>
  }
  const supabase = await createClient()
  const ids = phases.map((p) => p.id)
  // RLS: khách chỉ nhận thực đơn đã được chia sẻ
  const { data: plans } = ids.length
    ? await supabase.from('meal_plans').select('id, name, phase_id, is_template, shared_at, kcal, protein_g, carb_g, fat_g').in('phase_id', ids).not('shared_at', 'is', null).order('created_at', { ascending: false })
    : { data: [] }
  const planIds = (plans ?? []).map((p) => p.id)
  const { data: meals } = planIds.length
    ? await supabase.from('meals').select('id, meal_plan_id, day_number, meal_slot, dish, portion, kcal, notes, sort_order').in('meal_plan_id', planIds)
    : { data: [] }
  const today = todayVN()
  const cur = currentPhase(phases, today)

  return (
    <>
      <PageHeader title="Thực đơn" description={plans?.length ? undefined : 'HLV chưa chia sẻ thực đơn nào.'} />
      <KidSwitcher clients={clients} activeId={client.id} basePath="/me/thuc-don" />
      <div className="space-y-8">
        {(plans ?? []).map((p) => {
          const list = (meals ?? []).filter((m) => m.meal_plan_id === p.id) as (Meal & { meal_plan_id: string })[]
          const days = [...new Set(list.map((m) => m.day_number))].length
          const phase = phases.find((x) => x.id === p.phase_id)
          return (
            <MealPlanViewer key={p.id} plan={p as MealPlan} meals={list} phaseName={phase?.name ?? ''}
              todayDay={p.phase_id === cur?.id ? todayDayNumber(days, phase?.start_date ?? today, today) : null} canPrint={features.has('print_pdf')} />
          )
        })}
      </div>
    </>
  )
}
