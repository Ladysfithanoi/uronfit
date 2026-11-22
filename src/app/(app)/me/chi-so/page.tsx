import type { Metadata } from 'next'
import { portalContext } from '@/lib/portal'
import { PageHeader } from '@/components/layout/PageHeader'
import { KidSwitcher } from '@/components/portal/KidSwitcher'
import { FeatureLocked } from '@/components/portal/FeatureLocked'
import { MetricsTab } from '@/app/(app)/khach-hang/[id]/tabs/MetricsTab'

export const metadata: Metadata = { title: 'Chỉ số' }

export default async function MyMetricsPage() {
  const { clients, client, phases, tier, features } = await portalContext()
  if (!client) return <PageHeader title="Chỉ số" description="Chưa có hồ sơ." />
  if (!features.has('metrics_view')) {
    return <><PageHeader title="Chỉ số cơ thể" /><KidSwitcher clients={clients} activeId={client.id} basePath="/me/chi-so" /><FeatureLocked feature="Xem chỉ số & biểu đồ" tierName={tier?.name} /></>
  }
  return (
    <>
      <PageHeader title="Chỉ số cơ thể" description={features.has('metrics_entry') ? 'Biểu đồ và lịch sử đo. Bạn có thể tự nhập cân nặng và số đo vòng.' : 'Biểu đồ và lịch sử đo do HLV ghi nhận.'} />
      <KidSwitcher clients={clients} activeId={client.id} basePath="/me/chi-so" />
      <MetricsTab client={client} phases={phases} viewer="client" canEnter={features.has('metrics_entry')} showPhotos={features.has('photos_view')} />
    </>
  )
}
