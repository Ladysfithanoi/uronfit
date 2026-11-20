'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole, HttpError } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { run, must } from '@/lib/action'
import { youtubeId } from '@/lib/youtube'

export type ExerciseInput = {
  name: string; muscle_group: string; equipment: string; description: string; video_url: string
  image_path: string | null; tags: string[]; contraindications: string[]
}

export async function saveExercise(input: ExerciseInput, id?: string) {
  return run(async () => {
    const me = await requireApiRole('fm', 'pt')
    if (!input.name.trim()) throw new HttpError(400, 'Vui lòng nhập tên bài tập.')
    if (input.video_url.trim() && !youtubeId(input.video_url)) throw new HttpError(400, 'Link video phải là link YouTube hợp lệ.')
    if (input.image_path && !input.image_path.startsWith(`${me.id}/`) && !id) throw new HttpError(400, 'Ảnh không hợp lệ.')
    const supabase = await createClient()
    const row = {
      name: input.name.trim(), muscle_group: input.muscle_group.trim() || null, equipment: input.equipment.trim() || null,
      description: input.description.trim() || null, video_url: input.video_url.trim() || null,
      image_path: input.image_path, tags: input.tags, contraindications: input.contraindications,
    }
    let exId = id
    if (id) {
      const res = must(await supabase.from('exercises').update(row).eq('id', id).select('id'))
      if (!res?.length) throw new HttpError(403, 'Bạn chỉ sửa được bài tập do mình tạo.')
    } else {
      exId = must(await supabase.from('exercises').insert({ ...row, created_by: me.id }).select('id').single()).id
    }
    revalidatePath('/thu-vien')
    return { id: exId! }
  })
}

export async function deleteExercise(id: string) {
  return run(async () => {
    await requireApiRole('fm')
    const supabase = await createClient()
    const { error } = await supabase.from('exercises').delete().eq('id', id)
    if (error?.code === '23503') throw new HttpError(409, 'Bài tập đang được dùng trong giáo án nên không xoá được.')
    if (error) throw error
    revalidatePath('/thu-vien')
  })
}
