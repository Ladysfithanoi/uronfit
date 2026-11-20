'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'
import { parseDecimal } from '@/lib/num'
import { phaseForDate } from '@/lib/clients'

function refresh(clientId: string) {
  revalidatePath(`/khach-hang/${clientId}`)
  revalidatePath('/me', 'layout')
}

/**
 * Lưu số đo của một ngày. Mỗi chỉ số một giá trị/ngày (nhập lại = sửa).
 * HLV ghi nguồn "staff"; khách/phụ huynh ghi nguồn "client" và chỉ được nhập
 * cân nặng + số đo vòng (RLS cũng chặn).
 */
export async function saveMeasurements(clientId: string, date: string, entries: { metric_type_id: string; value: string }[]) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt', 'client', 'guardian')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Ngày đo không hợp lệ.')
    const supabase = await createClient()
    const isStaff = me.role === 'fm' || me.role === 'pt'

    const [types, phases, existing] = await Promise.all([
      supabase.from('metric_types').select('id, kind, client_can_enter, name'),
      supabase.from('phases').select('id, start_date, end_date, sort_order').eq('client_id', clientId),
      supabase.from('measurements').select('id, metric_type_id, source, measured_by').eq('client_id', clientId).eq('measured_on', date),
    ])
    const typeMap = new Map(must(types).map((t) => [t.id, t]))
    const phase = phaseForDate(must(phases), date)
    const current = new Map(must(existing).map((m) => [m.metric_type_id, m]))

    let saved = 0
    for (const e of entries) {
      const t = typeMap.get(e.metric_type_id)
      if (!t) continue
      if (!isStaff && !t.client_can_enter) continue
      const raw = e.value.trim()
      const prev = current.get(e.metric_type_id)

      if (!raw) {
        if (prev && (isStaff || (prev.source === 'client' && prev.measured_by === me.id))) {
          must(await supabase.from('measurements').delete().eq('id', prev.id))
        }
        continue
      }
      let value_num: number | null = null
      let value_text: string | null = null
      if (t.kind === 'number') {
        value_num = parseDecimal(raw)
        if (value_num === null || value_num < 0 || value_num > 1000) throw new HttpError(400, `"${t.name}" phải là số hợp lệ.`)
      } else value_text = raw

      if (prev && !isStaff && prev.source === 'staff') {
        throw new HttpError(409, `HLV đã nhập "${t.name}" cho ngày này. Hãy chọn ngày khác hoặc nhờ HLV sửa.`)
      }
      const row = {
        client_id: clientId, metric_type_id: t.id, measured_on: date, phase_id: phase?.id ?? null,
        value_num, value_text, measured_by: me.id, source: isStaff ? 'staff' : 'client',
      }
      if (prev) must(await supabase.from('measurements').update(row).eq('id', prev.id))
      else must(await supabase.from('measurements').insert(row))
      saved++
    }
    refresh(clientId)
    return { saved }
  })
}

export async function deleteMeasurementsOn(clientId: string, date: string) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt', 'client', 'guardian')
    const supabase = await createClient()
    let q = supabase.from('measurements').delete().eq('client_id', clientId).eq('measured_on', date)
    if (me.role === 'client' || me.role === 'guardian') q = q.eq('source', 'client').eq('measured_by', me.id)
    must(await q)
    refresh(clientId)
  })
}

export async function toggleOptionalMetric(clientId: string, metricId: string, on: boolean) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    const { data } = await supabase.from('clients').select('enabled_metrics').eq('id', clientId).single()
    const set = new Set<string>(data?.enabled_metrics ?? [])
    if (on) set.add(metricId); else set.delete(metricId)
    must(await supabase.from('clients').update({ enabled_metrics: [...set] }).eq('id', clientId))
    refresh(clientId)
  })
}

export async function addCustomMetric(clientId: string, input: { name: string; unit: string; kind: 'number' | 'text' }) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    if (!input.name.trim()) throw new HttpError(400, 'Vui lòng nhập tên chỉ số.')
    const supabase = await createClient()
    must(await supabase.from('metric_types').insert({
      name: input.name.trim(), unit: input.unit.trim() || null, kind: input.kind,
      client_id: clientId, is_default: false, default_enabled: true, sort_order: 100, created_by: me.id,
    }))
    refresh(clientId)
  })
}

export async function deleteCustomMetric(clientId: string, metricId: string) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    must(await supabase.from('metric_types').delete().eq('id', metricId).eq('client_id', clientId))
    refresh(clientId)
  })
}

// ─── Ảnh tiến độ / ảnh tư thế ───────────────────────────────────────────────
export async function addPhotos(clientId: string, photos: { path: string; taken_on: string; angle: string }[]) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    const phases = must(await supabase.from('phases').select('id, start_date, end_date, sort_order').eq('client_id', clientId))
    const rows = photos.map((p) => {
      if (!p.path.startsWith(`${clientId}/`)) throw new HttpError(400, 'Đường dẫn ảnh không hợp lệ.')
      return { client_id: clientId, storage_path: p.path, taken_on: p.taken_on, angle: p.angle,
        phase_id: phaseForDate(phases, p.taken_on)?.id ?? null, uploaded_by: me.id }
    })
    must(await supabase.from('progress_photos').insert(rows))
    refresh(clientId)
  })
}

export async function deletePhoto(clientId: string, id: string) {
  return run(async () => {
    await requireApiRole('fm', 'pt')
    const supabase = await createClient()
    const photo = must(await supabase.from('progress_photos').select('storage_path').eq('id', id).single())
    must(await supabase.from('progress_photos').delete().eq('id', id))
    await supabase.storage.from('client-media').remove([photo.storage_path])
    refresh(clientId)
  })
}
