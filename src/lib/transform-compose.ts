// Ghép 2 ảnh Trước/Sau thành 1 ảnh (chạy trên canvas trong trình duyệt) — ý từ app Chisu.
// Bố cục: 2 khung 3:4 cạnh nhau, nhãn TRƯỚC/SAU + ngày + cân nặng, nhãn chênh lệch ở giữa,
// dải logo UR PRIVATE GYM. Chỉ dùng khi khách đã đồng ý cho dùng ảnh.
const W = 720, H = 960, BRAND = '#FD3786'

export type Side = { url: string; label: string; date: string; weight?: number | null }

export async function composeBeforeAfter(before: Side, after: Side, logoUrl = '/brand/logo-512.png'): Promise<Blob> {
  const [a, b, logo] = await Promise.all([load(before.url), load(after.url), load(logoUrl).catch(() => null)])
  const canvas = document.createElement('canvas')
  canvas.width = W * 2; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W * 2, H)
  cover(ctx, a, 0, W); cover(ctx, b, W, W)
  ctx.fillStyle = BRAND; ctx.fillRect(W - 3, 0, 6, H)
  label(ctx, 0, before); label(ctx, W, after)

  if (before.weight && after.weight) {
    const diff = Math.round((after.weight - before.weight) * 10) / 10
    if (diff !== 0) {
      const text = `${diff < 0 ? '−' : '+'}${String(Math.abs(diff)).replace('.', ',')} KG`
      ctx.font = '800 54px "Be Vietnam Pro", Arial, sans-serif'
      const w = ctx.measureText(text).width + 80, h = 92, y = H - 290
      ctx.fillStyle = BRAND
      round(ctx, W - w / 2, y - h / 2, w, h, h / 2); ctx.fill()
      ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(text, W, y + 3); ctx.textBaseline = 'alphabetic'
    }
  }
  if (logo) ctx.drawImage(logo, W - 60, 24, 120, 120)

  return new Promise((resolve, reject) => canvas.toBlob((bl) => (bl ? resolve(bl) : reject(new Error('Không tạo được ảnh'))), 'image/jpeg', 0.9))
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, w: number) {
  const s = Math.max(w / img.width, H / img.height)
  const dw = img.width * s, dh = img.height * s
  ctx.save(); ctx.beginPath(); ctx.rect(x, 0, w, H); ctx.clip()
  ctx.drawImage(img, x + (w - dw) / 2, (H - dh) / 2, dw, dh); ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, x: number, s: Side) {
  const g = ctx.createLinearGradient(0, H - 260, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.fillStyle = g; ctx.fillRect(x, H - 260, W, 260)
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'
  ctx.font = '800 60px "Be Vietnam Pro", Arial, sans-serif'
  ctx.fillText(s.label, x + W / 2, H - 120)
  ctx.font = '500 34px "Be Vietnam Pro", Arial, sans-serif'; ctx.fillStyle = '#ddd'
  ctx.fillText([s.date, s.weight ? `${String(s.weight).replace('.', ',')} kg` : ''].filter(Boolean).join('  ·  '), x + W / 2, H - 60)
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // ảnh từ Supabase Storage: cần CORS để canvas xuất được
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Không tải được ảnh'))
    img.src = url
  })
}
