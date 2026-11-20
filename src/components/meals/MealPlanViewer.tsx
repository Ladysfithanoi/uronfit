'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MacroTargets, DayMeals } from './MealView'
import type { Meal, MealPlan } from '@/lib/meals'
import { cn } from '@/lib/utils'

export function MealPlanViewer({ plan, meals, phaseName, todayDay }: { plan: MealPlan; meals: Meal[]; phaseName: string; todayDay: number | null }) {
  const days = [...new Set(meals.map((m) => m.day_number))].sort((a, b) => a - b)
  const [day, setDay] = useState(todayDay && days.includes(todayDay) ? todayDay : days[0] ?? 1)
  return (
    <section>
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1"><p className="label-caps">{phaseName}</p><h2 className="text-xl font-bold">{plan.name}</h2></div>
        <Button variant="ghost" size="icon" className="no-print" aria-label="In / Xuất PDF" onClick={() => window.print()}><Printer /></Button>
      </div>
      <MacroTargets plan={plan} className="mb-4" />
      <div className="no-print -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {days.map((d) => (
          <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={d === day}
            className={cn('min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium', d === day ? 'border-brand bg-brand/15' : 'border-border text-muted-foreground')}>
            Ngày {d}{d === todayDay && ' · hôm nay'}
          </button>
        ))}
      </div>
      {/* Màn hình: một ngày; bản in: tất cả các ngày */}
      <div className="print:hidden"><DayMeals meals={meals.filter((m) => m.day_number === day)} target={plan.kcal} /></div>
      <div className="hidden space-y-6 print:block">
        {days.map((d) => <div key={d}><h3 className="mb-2 font-bold">Ngày {d}</h3><DayMeals meals={meals.filter((m) => m.day_number === d)} target={plan.kcal} /></div>)}
      </div>
    </section>
  )
}
