/** Lấy mã video từ mọi dạng link YouTube (watch, youtu.be, shorts, embed). */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return clean(u.pathname.slice(1))
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return clean(u.searchParams.get('v')!)
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/)
      if (m) return clean(m[2])
    }
  } catch { /* không phải URL */ }
  return null
}
const clean = (id: string) => (/^[\w-]{6,20}$/.test(id) ? id : null)

/** Nhúng chế độ riêng tư nâng cao của YouTube (không đặt cookie theo dõi trước khi bấm phát) */
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`
