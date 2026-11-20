'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/app-dialog'
import { deleteGroup } from '../actions'

export function DeleteGroup({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button variant="destructive" disabled={pending} onClick={async () => {
      if (!(await confirmDialog({ title: `Xoá nhóm "${name}"?`, description: 'Giáo án nhóm và điểm danh sẽ bị xoá. Hồ sơ, chỉ số và gói tập của từng khách vẫn giữ nguyên.', confirmLabel: 'Xoá nhóm', destructive: true }))) return
      start(async () => {
        const r = await deleteGroup(id)
        if (r.ok) { toast.success('Đã xoá nhóm.'); router.push('/nhom') } else toast.error(r.error)
      })
    }}><Trash2 /> Xoá nhóm</Button>
  )
}
