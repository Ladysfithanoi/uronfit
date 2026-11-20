// Ngày giờ luôn theo múi giờ Việt Nam, định dạng dd/mm/yyyy.
export const VN_TZ = 'Asia/Ho_Chi_Minh'

const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: VN_TZ, day: '2-digit', month: '2-digit', year: 'numeric',
})
const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: VN_TZ, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

/** "2026-11-20" hoặc Date/ISO → "20/11/2026" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  // Chuỗi ngày thuần (yyyy-mm-dd) không có giờ: định dạng trực tiếp, tránh lệch múi giờ
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return dateFmt.format(new Date(value))
}

/** → "20/11/2026 14:05" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return dateTimeFmt.format(new Date(value)).replace(',', '')
}

/** Ngày hôm nay theo giờ Việt Nam, dạng yyyy-mm-dd */
export function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ }).format(new Date())
}

/** "dd/mm/yyyy" → "yyyy-mm-dd" (null nếu sai định dạng) */
export function parseVNDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  return Number.isNaN(Date.parse(iso)) ? null : iso
}
