import type { Metadata } from 'next'
import { portalContext, sharedPlanIds } from '@/lib/portal'
import { loadSessions } from '@/lib/plans'
import { PageHeader } from '@/components/layout/PageHeader'
import { KidSwitcher } from '@/components/portal/KidSwitcher'
import { FeatureLocked } from '@/components/portal/FeatureLocked'
import { PlanViewer } from '@/components/plans/PlanViewer'

export const metadata: Metadata = { title: 'Giáo án' }

export default async function MyPlansPage() {
  const { clients, client, phases, tier, features } = await portalContext()
  if (!client) return <PageHeader title="Giáo án" description="Chưa có hồ sơ." />
  if (!features.has('workout_view')) {
    return <><PageHeader title="Giáo án" /><KidSwitcher clients={clients} activeId={client.id} basePath="/me/giao-an" /><FeatureLocked feature="Xem giáo án" tierName={tier?.name} /></>
  }
  const plans = await sharedPlanIds(client.id, phases.map((p) => p.id))
  const sessions = await loadSessions(plans.map((p) => p.id))
  const phaseName = new Map(phases.map((p) => [p.id, p.name]))
  const media = features.has('workout_media')
  // Gói không có ảnh/video: bỏ hẳn link khỏi dữ liệu gửi xuống trình duyệt (không chỉ ẩn nút)
  if (!media) for (const list of sessions.values()) for (const s of list) for (const e of s.exercises) { e.exercise.video_url = null; e.exercise.image_url = null }

  return (
    <>
      <PageHeader title="Giáo án" description={plans.length ? `Bấm vào buổi để xem bài${media ? ', ảnh và video hướng dẫn' : ' và hướng dẫn kỹ thuật'}.` : 'HLV chưa chia sẻ giáo án nào.'} />
      <KidSwitcher clients={clients} activeId={client.id} basePath="/me/giao-an" />
      <div className="space-y-8">
        {[...plans].reverse().map((p) => (
          <PlanViewer key={p.id} clientId={client.id} name={p.name}
            subtitle={p.group_id ? 'Giáo án nhóm' : phaseName.get(p.phase_id ?? '') ?? ''}
            sessions={sessions.get(p.id) ?? []} isGroup={!!p.group_id}
            canSelfTrack={features.has('self_training')} canPrint={features.has('print_pdf')} />
        ))}
      </div>
    </>
  )
}
