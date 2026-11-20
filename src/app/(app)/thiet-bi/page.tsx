import type { Metadata } from 'next'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { currentDeviceKey } from '@/lib/devices'
import { PageHeader } from '@/components/layout/PageHeader'
import { DeviceList } from './DeviceList'

export const metadata: Metadata = { title: 'Thiết bị đang đăng nhập' }

export default async function DevicesPage() {
  await requirePageRole()
  const supabase = await createClient()
  const key = await currentDeviceKey()

  // RLS: chỉ thấy thiết bị của chính mình
  const { data } = await supabase.from('devices')
    .select('id, device_key, label, first_seen, last_seen')
    .is('revoked_at', null)
    .order('last_seen', { ascending: false })

  const devices = (data ?? []).map(({ device_key, ...d }) => ({ ...d, current: device_key === key }))
  devices.sort((a, b) => Number(b.current) - Number(a.current))

  return (
    <div className="max-w-lg">
      <PageHeader eyebrow="Tài khoản" title="Thiết bị đang đăng nhập"
        description="Mỗi máy mới phải xác nhận qua email. Thấy máy lạ? Đăng xuất máy đó ngay." />
      <DeviceList devices={devices} />
    </div>
  )
}
