import type { Metadata } from 'next'
import { requirePageRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { signedUrls } from '@/lib/storage'
import { PageHeader } from '@/components/layout/PageHeader'
import { Library, type Exercise } from '@/components/exercises/Library'
import { LibraryTabs } from './LibraryTabs'

export const metadata: Metadata = { title: 'Thư viện bài tập' }

export default async function LibraryPage() {
  const me = await requirePageRole('fm', 'pt')
  const supabase = await createClient()
  const { data } = await supabase.from('exercises')
    .select('id, name, muscle_group, equipment, description, image_path, video_url, tags, contraindications, created_by')
    .order('name')
  const urls = await signedUrls('exercise-media', (data ?? []).map((e) => e.image_path))
  const exercises = (data ?? []).map((e) => ({ ...e, image_url: e.image_path ? urls.get(e.image_path) ?? null : null })) as Exercise[]

  return (
    <>
      <PageHeader eyebrow="Thư viện" title="Bài tập" description={`${exercises.length} bài. Ảnh và video do phòng tập bổ sung dần.`} />
      <LibraryTabs active="bai-tap" />
      <Library exercises={exercises} meId={me.id} isFm={me.role === 'fm'} />
    </>
  )
}
