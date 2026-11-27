/**
 * Superset (Vertical Loading, theo app training-plan): các bài LIỀN NHAU có cùng chữ cái
 * superset_group được tập luân phiên (A1 → A2 → nghỉ → A1 …). Bài đơn: superset_group = null.
 * Nhãn hiển thị (A, B1, B2, C…) tính theo thứ tự bài, không lưu trong database.
 */
export const MAX_SUPERSET = 4
export const SUPERSET_NAME: Record<number, string> = { 2: 'Superset', 3: 'Tri-set', 4: 'Giant set' }

type Item = { id: string; superset_group: string | null }
export type Block<T> = { letter: string; superset: boolean; items: { e: T; label: string; last: boolean }[] }

/** Gom bài thành khối: mỗi đoạn liền nhau cùng nhóm (≥ 2 bài) là một superset */
export function supersetBlocks<T extends Item>(list: T[]): Block<T>[] {
  const runs: T[][] = []
  for (const e of list) {
    const prev = runs.at(-1)
    if (prev && e.superset_group && prev[0].superset_group === e.superset_group) prev.push(e)
    else runs.push([e])
  }
  // Buổi không có superset: giữ số thứ tự 1, 2, 3 như cũ
  const any = runs.some((r) => r.length > 1)
  return runs.map((r, i) => {
    const letter = any ? String.fromCharCode(65 + (i % 26)) : String(i + 1)
    const superset = r.length > 1
    return { letter, superset, items: r.map((e, k) => ({ e, label: superset ? `${letter}${k + 1}` : letter, last: k === r.length - 1 })) }
  })
}

/**
 * Chuẩn hoá nhóm sau mỗi thay đổi: đoạn chỉ còn 1 bài → bỏ nhóm; hai đoạn trùng chữ → đặt lại chữ.
 * Trả về những dòng cần cập nhật.
 */
export function normalizeGroups<T extends Item>(list: T[]): { id: string; superset_group: string | null }[] {
  const out: { id: string; superset_group: string | null }[] = []
  let n = 0
  for (const b of supersetBlocks(list)) {
    const want = b.superset ? String.fromCharCode(65 + (n++ % 26)) : null
    for (const { e } of b.items) if (e.superset_group !== want) out.push({ id: e.id, superset_group: want })
  }
  return out
}

/** Bài một khách thực sự tập: dòng chỉnh riêng thay cho dòng chung, giữ nhóm superset của dòng chung */
export function clientExercises<T extends Item & { client_id: string | null; replaces_id: string | null }>(list: T[], clientId: string): T[] {
  const mine = list.filter((e) => e.client_id === clientId)
  return list.filter((e) => !e.client_id).map((e) => {
    const o = mine.find((m) => m.replaces_id === e.id)
    return o ? { ...o, superset_group: e.superset_group } : e
  })
}
