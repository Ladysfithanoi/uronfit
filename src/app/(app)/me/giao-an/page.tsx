import type { Metadata } from 'next'
import { portalContext, sharedPlanIds } from '@/lib/portal'
import { loadSessions } from '@/lib/plans'
import { PageHeader } from '@/components/layout/PageHeader'
import { KidSwitcher } from '@/components/portal/KidSwitcher'
import { PlanViewer } from '@/components/plans/PlanViewer'

export const metadata: Metadata = { title: 'Giáo án' }

export default async function MyPlansPage() {
  const { clients, client, phases } = await portalContext()
  if (!client) return <PageHeader title="Giáo án" description="Chưa có hồ sơ." />
  const plans = await sharedPlanIds(client.id, phases.map((p) => p.id))
  const sessions = await loadSessions(plans.map((p) => p.id))
  const phaseName = new Map(phases.map((p) => [p.id, p.name]))

  return (
    <>
      <PageHeader title="Giáo án" description={plans.length ? 'Bấm vào buổi để xem bài, ảnh và video hướng dẫn.' : 'HLV chưa chia sẻ giáo án nào.'} />
      <KidSwitcher clients={clients} activeId={client.id} basePath="/me/giao-an" />
      <div className="space-y-8">
        {[...plans].reverse().map((p) => (
          <PlanViewer key={p.id} clientId={client.id} name={p.name}
            subtitle={p.group_id ? 'Giáo án nhóm' : phaseName.get(p.phase_id ?? '') ?? ''}
            sessions={sessions.get(p.id) ?? []} isGroup={!!p.group_id} />
        ))}
      </div>
    </>
  )
}
