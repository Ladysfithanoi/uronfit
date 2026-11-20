'use client'

import { TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EXERCISE_TAG_LABEL, HEALTH_FLAG_LABEL } from '@/lib/labels'
import { youtubeEmbed, youtubeId } from '@/lib/youtube'

export type ExerciseMedia = {
  name: string; muscle_group: string | null; equipment: string | null; description: string | null
  image_url: string | null; video_url: string | null; tags: string[]; contraindications: string[]
}

/** Chi tiết bài tập: video YouTube nhúng, ảnh, mô tả kỹ thuật, nhãn, chống chỉ định */
export function ExerciseDetail({ ex }: { ex: ExerciseMedia }) {
  const vid = youtubeId(ex.video_url)
  return (
    <div className="space-y-3">
      {vid && (
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <iframe src={youtubeEmbed(vid)} title={`Video ${ex.name}`} className="size-full" loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
        </div>
      )}
      {ex.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ex.image_url} alt={ex.name} className="max-h-72 w-full rounded-lg object-contain bg-black" />
      )}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {ex.muscle_group && <Badge variant="secondary">{ex.muscle_group}</Badge>}
        {ex.equipment && <Badge variant="outline">{ex.equipment}</Badge>}
        {ex.tags.map((t) => <Badge key={t} variant="outline">{EXERCISE_TAG_LABEL[t] ?? t}</Badge>)}
      </div>
      {ex.description ? <p className="whitespace-pre-line text-sm">{ex.description}</p> : <p className="text-sm text-muted-foreground">Chưa có mô tả kỹ thuật.</p>}
      {ex.contraindications.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span><b>Chống chỉ định:</b> {ex.contraindications.map((c) => HEALTH_FLAG_LABEL[c] ?? c).join(', ')}</span>
        </p>
      )}
    </div>
  )
}
