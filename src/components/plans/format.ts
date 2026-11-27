import { fmtNum } from '@/lib/num'

type P = { sets: number | null; reps: string | null; duration_sec: number | null; weight_kg: number | null; rest_sec: number | null }

/** "3 hiệp × 10 lần · 20 kg · nghỉ 60s" */
/** inSuperset: bài chưa phải bài cuối của nhóm superset → chuyển ngay sang bài kế, không nghỉ */
export function exerciseLine(e: P, inSuperset = false): string {
  const parts: string[] = []
  const vol = [e.sets ? `${e.sets} hiệp` : null, e.reps ? `${e.reps} lần` : null, e.duration_sec ? fmtDuration(e.duration_sec) : null].filter(Boolean).join(' × ')
  if (vol) parts.push(vol)
  if (e.weight_kg !== null && e.weight_kg !== undefined) parts.push(`${fmtNum(Number(e.weight_kg))} kg`)
  if (inSuperset) parts.push('chuyển ngay sang bài kế')
  else if (e.rest_sec) parts.push(`nghỉ ${fmtDuration(e.rest_sec)}`)
  return parts.join(' · ') || 'Chưa đặt thông số'
}

function fmtDuration(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), r = s % 60
  return r ? `${m}p${r}s` : `${m} phút`
}
