import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { MealEditor } from '@/components/meals/MealEditor'
import type { Meal, MealPlan } from '@/lib/meals'
import type { CalcContext } from '@/lib/nutrition'
import { calcContextFor } from '@/lib/nutrition-server'

export const metadata: Metadata = { title: 'Thực đơn' }

export default async function MealPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePageRole('fm', 'pt')
  const supabase = await createClient()
  const [{ data: plan }, { data: meals }] = await Promise.all([
    supabase.from('meal_plans').select('id, name, phase_id, is_template, shared_at, kcal, protein_g, carb_g, fat_g').eq('id', id).maybeSingle(),
    supabase.from('meals').select('id, day_number, meal_slot, dish, portion, kcal, notes, sort_order').eq('meal_plan_id', id),
  ])
  if (!plan) notFound()
  let back = { href: '/thu-vien/mau?loai=thuc-don', label: 'Mẫu thực đơn' }, context = 'Mẫu thực đơn'
  let calc: CalcContext | null = null
  if (plan.phase_id) {
    const { data } = await supabase.from('phases').select('name, clients(id, full_name)').eq('id', plan.phase_id).single()
    const c = data?.clients as unknown as { id: string; full_name: string } | null
    if (c) { back = { href: `/khach-hang/${c.id}?tab=thuc-don`, label: c.full_name }; context = `${c.full_name} · ${data?.name}`; calc = await calcContextFor(c.id) }
  }
  return (
    <>
      <Link href={back.href} className="no-print mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> {back.label}</Link>
      <MealEditor plan={plan as MealPlan} meals={(meals ?? []) as Meal[]} context={context} calc={calc} />
    </>
  )
}
