/**
 * Đọc số người dùng gõ. Bàn phím số tiếng Việt trên điện thoại gõ ra dấu phẩy ("58,4"),
 * nên ô nhập dùng type="text" inputMode="decimal" và đọc qua hàm này (bài học từ app Chisu).
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  const s = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function parseIntOrNull(input: string | null | undefined): number | null {
  const n = parseDecimal(input ?? null)
  return n === null ? null : Math.round(n)
}

/** Chỉ giữ chữ số và một dấu phẩy/chấm khi gõ */
export function cleanDecimalInput(v: string): string {
  return v.replace(/[^\d.,]/g, '')
}

/** 58.4 → "58,4" (kiểu Việt Nam) */
export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(digits).replace('.', ',')
}

export function fmtDelta(n: number | null | undefined, unit = ''): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  if (n === 0) return `0${unit ? ' ' + unit : ''}`
  return `${n > 0 ? '+' : '−'}${fmtNum(Math.abs(n))}${unit ? ' ' + unit : ''}`
}
