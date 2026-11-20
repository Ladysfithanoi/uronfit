import { createClient } from '@/lib/supabase/server'
import { signedUrls } from '@/lib/storage'
import { metricsForClient, optionalMetrics, type Measurement, type MetricType } from '@/lib/metrics'
import type { Client, Phase } from '@/lib/clients'
import { MetricsView } from '@/components/metrics/MetricsView'

/** Dùng chung cho HLV (tab hồ sơ khách) và khách/phụ huynh (cổng khách hàng) */
export async function MetricsTab({ client, phases, viewer }: { client: Client; phases: Phase[]; viewer: 'staff' | 'client' }) {
  const supabase = await createClient()
  const [{ data: types }, { data: ms }, { data: photos }] = await Promise.all([
    supabase.from('metric_types').select('*'),
    supabase.from('measurements').select('id, metric_type_id, measured_on, value_num, value_text, phase_id, source, measured_by')
      .eq('client_id', client.id).order('measured_on'),
    supabase.from('progress_photos').select('id, taken_on, angle, storage_path, phase_id').eq('client_id', client.id).order('taken_on'),
  ])
  const all = (types ?? []) as MetricType[]
  const metrics = metricsForClient(all, client.id, client.goals, client.enabled_metrics)
  const urls = await signedUrls('client-media', (photos ?? []).map((p) => p.storage_path))

  return (
    <MetricsView
      clientId={client.id}
      clientName={client.full_name}
      viewer={viewer}
      metrics={metrics}
      optional={viewer === 'staff' ? optionalMetrics(all, client.goals) : []}
      enabled={client.enabled_metrics}
      measurements={(ms ?? []) as Measurement[]}
      phases={phases.map((p) => ({ id: p.id, name: p.name, start_date: p.start_date, end_date: p.end_date, sort_order: p.sort_order }))}
      photos={(photos ?? []).map((p) => ({ id: p.id, taken_on: p.taken_on, angle: p.angle, phase_id: p.phase_id, url: urls.get(p.storage_path) ?? null }))}
      photoConsent={client.photo_consent}
    />
  )
}
