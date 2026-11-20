import type { Metadata } from 'next'
import { portalContext } from '@/lib/portal'
import { PageHeader } from '@/components/layout/PageHeader'
import { KidSwitcher } from '@/components/portal/KidSwitcher'
import { MetricsTab } from '@/app/(app)/khach-hang/[id]/tabs/MetricsTab'

export const metadata: Metadata = { title: 'Chỉ số' }

export default async function MyMetricsPage() {
  const { clients, client, phases } = await portalContext()
  if (!client) return <PageHeader title="Chỉ số" description="Chưa có hồ sơ." />
  return (
    <>
      <PageHeader title="Chỉ số cơ thể" description="Biểu đồ và lịch sử đo. Bạn có thể tự nhập cân nặng và số đo vòng." />
      <KidSwitcher clients={clients} activeId={client.id} basePath="/me/chi-so" />
      <MetricsTab client={client} phases={phases} viewer="client" />
    </>
  )
}
