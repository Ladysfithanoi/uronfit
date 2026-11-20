import 'server-only'
import type { GoalGroup } from '@/lib/types'

/**
 * Lịch tập bằng AI — theo cách của app training-plan: PT khai báo → dựng prompt kèm
 * THƯ VIỆN bài tập (mã E1, E2…) → Gemini trả JSON đúng schema → kiểm tra từng giá trị.
 * AI chỉ được chọn bài trong thư viện. Bài có chống chỉ định trùng tiền sử của khách bị
 * LOẠI KHỎI danh sách trước khi gửi cho AI — AI không thể chọn chúng.
 * Không có AI (thiếu key / lỗi) → buildFallbackPlan() dựng lịch theo quy tắc.
 */

export type AiLevel = 'beginner' | 'intermediate' | 'advanced'
export type AiEquipment = 'full_gym' | 'machines_dumbbells' | 'home_minimal'

export type WorkoutAnswers = {
  name: string
  level: AiLevel
  sessionsPerWeek: number
  sessionMinutes: number
  weeks: number
  equipment: AiEquipment
  focusMuscles: string[]
  notes: string
}

export type ClientContext = {
  gender: 'female' | 'male'
  age: number | null
  goals: GoalGroup[]
  isKid: boolean
  healthFlags: string[]
  healthText: string // chấn thương, phẫu thuật, bệnh lý, chỉ định bác sĩ, động tác cần tránh
}

export type LibraryExercise = {
  id: string; name: string; muscle_group: string | null; equipment: string | null; tags: string[]; contraindications: string[]
}

export type PlanExercise = { exercise_id: string; name: string; sets: number; reps: string | null; duration_sec: number | null; rest_sec: number; note: string | null }
export type PlanDay = { label: string; exercises: PlanExercise[] }
export type WorkoutDraft = { name: string; days: PlanDay[]; usedAi: boolean; dropped: number; excludedForSafety: number }

export const FOCUS_OPTIONS = ['Mông', 'Đùi', 'Lưng', 'Ngực', 'Vai', 'Tay', 'Bụng / Core'] as const

const LEVEL_BRIEF: Record<AiLevel, string> = {
  beginner: 'mới tập (dưới 6 tháng)', intermediate: 'trung cấp (6 tháng – 2 năm)', advanced: 'nâng cao (trên 2 năm)',
}
const EQUIP_BRIEF: Record<AiEquipment, string> = {
  full_gym: 'phòng gym đầy đủ (tạ đòn, máy, cáp, tạ đơn)',
  machines_dumbbells: 'chỉ máy, cáp, tạ đơn — không tạ đòn',
  home_minimal: 'tập tại nhà: tạ đơn, dây kháng lực, trọng lượng cơ thể',
}

// ─── Kiểm tra dữ liệu PT gửi lên ──────────────────────────────────────────────
const clampInt = (v: unknown, min: number, max: number, d: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d
}
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export function sanitizeAnswers(raw: Partial<WorkoutAnswers>): WorkoutAnswers {
  return {
    name: txt(raw.name, 80),
    level: (['beginner', 'intermediate', 'advanced'] as const).includes(raw.level as AiLevel) ? raw.level as AiLevel : 'beginner',
    sessionsPerWeek: clampInt(raw.sessionsPerWeek, 1, 6, 3),
    sessionMinutes: [30, 45, 60, 75, 90].includes(Number(raw.sessionMinutes)) ? Number(raw.sessionMinutes) : 60,
    weeks: clampInt(raw.weeks, 1, 12, 4),
    equipment: (['full_gym', 'machines_dumbbells', 'home_minimal'] as const).includes(raw.equipment as AiEquipment) ? raw.equipment as AiEquipment : 'full_gym',
    focusMuscles: Array.isArray(raw.focusMuscles) ? raw.focusMuscles.filter((m) => (FOCUS_OPTIONS as readonly string[]).includes(m)) : [],
    notes: txt(raw.notes, 500),
  }
}

// ─── Thư viện gửi cho AI ──────────────────────────────────────────────────────
const HOME_OK = /không dụng cụ|thảm|dây|tạ đơn|ghế|tường|foam|bục|tạ ấm/i
const NO_BARBELL = /tạ đòn|smith/i

/** Loại bài chống chỉ định (bắt buộc) + lọc theo dụng cụ / đối tượng (nới ra nếu còn quá ít bài). */
export function prepareLibrary(all: LibraryExercise[], answers: WorkoutAnswers, ctx: ClientContext) {
  const safe = all.filter((e) => !e.contraindications.some((c) => ctx.healthFlags.includes(c)))
  const excludedForSafety = all.length - safe.length
  let lib = safe
  const byEquip = answers.equipment === 'home_minimal' ? lib.filter((e) => HOME_OK.test(e.equipment ?? ''))
    : answers.equipment === 'machines_dumbbells' ? lib.filter((e) => !NO_BARBELL.test(e.equipment ?? '')) : lib
  if (byEquip.length >= 12) lib = byEquip
  if (ctx.isKid) {
    const kid = lib.filter((e) => e.tags.includes('kids') || /không dụng cụ|thảm|dây|bục/i.test(e.equipment ?? ''))
    if (kid.length >= 8) lib = kid
  }
  return { library: lib, excludedForSafety }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────
const SYSTEM = `Bạn là huấn luyện viên thể lực dựa trên bằng chứng (Muscle & Strength Pyramid, RP volume landmarks), làm việc tại một phòng tập riêng tư ở Việt Nam (khoảng 90% khách là nữ, 15–40 tuổi, có cả trẻ em). Nhiệm vụ: thiết kế MỘT TUẦN TẬP MẪU cho khách; tuần này sẽ được lặp lại trong suốt giai đoạn và PT sẽ tự điều chỉnh tải.

LUẬT BẮT BUỘC:
- CHỈ dùng bài trong THƯ VIỆN, ghi đúng mã (E1, E2…) vào trường "ref". Không bịa bài, không lặp bài trong cùng một buổi.
- Viết mọi tên buổi, ghi chú bằng tiếng Việt, xưng hô trung tính.
- Số buổi ("days") đúng bằng số buổi/tuần được yêu cầu. Mỗi buổi có nhãn NGẮN (tối đa 25 ký tự) phân biệt các buổi, vd "Thân dưới A", "Mông & core", "Toàn thân 1". Tên giáo án tối đa 50 ký tự.
- Số bài mỗi buổi theo thời lượng: 30 phút → 3–4; 45 → 4–5; 60 → 5–6; 75 → 6–7; 90 → 7–8.
- Thứ tự: khởi động / kích hoạt (nếu có) → bài đa khớp nặng → bài cô lập → core.
- Mỗi bài: sets 1–5; "reps" là chuỗi như "10" hoặc "8-12"; bài giữ tư thế / cardio dùng "duration_sec" (giây) và để reps = ""; "rest_sec" 30–180.
- "note": một lưu ý kỹ thuật ngắn (≤ 100 ký tự) hoặc "".
- TÔN TRỌNG TIỀN SỬ SỨC KHOẺ: tránh mọi động tác làm nặng vùng bị ảnh hưởng, ưu tiên phương án an toàn hơn.

THEO MỤC TIÊU:
- Giảm mỡ: 8–15 lần, nghỉ 45–75 giây, ưu tiên bài đa khớp, có thể ghép cặp (superset) để tăng mật độ.
- Tăng cân / tăng cơ: 6–12 lần với bài đa khớp, 10–20 lần với máy/cáp/cô lập, nghỉ 60–120 giây.
- Chỉnh dáng: kích hoạt và tăng sức mạnh chuỗi cơ yếu (mông nhỡ, lưng trên, core sâu), kết hợp bài di động; ưu tiên bài có nhãn "chỉnh dáng"; nhịp chậm, kiểm soát.
- Phục hồi chức năng: RẤT THẬN TRỌNG — tải nhẹ, biên độ không đau, nhiều bài giữ tĩnh và kiểm soát vận động, ưu tiên bài có nhãn "phục hồi", không gắng sức tối đa, 1–3 hiệp.
- Trẻ em: vui, chủ yếu trọng lượng cơ thể, phối hợp – thăng bằng – sức bền, 8–15 lần hoặc 20–40 giây, KHÔNG tạ nặng; ưu tiên bài có nhãn "trẻ em".
- Người mới tập: chọn bài dễ học kỹ thuật, ít hiệp hơn.`

export const PLAN_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ref: { type: 'string' }, sets: { type: 'integer' }, reps: { type: 'string' },
                duration_sec: { type: 'integer' }, rest_sec: { type: 'integer' }, note: { type: 'string' },
              },
              required: ['ref', 'sets', 'reps', 'duration_sec', 'rest_sec', 'note'],
            },
          },
        },
        required: ['label', 'exercises'],
      },
    },
  },
  required: ['name', 'days'],
}

const GOAL_VI: Record<GoalGroup, string> = { fat_loss: 'Giảm cân / giảm mỡ', weight_gain: 'Tăng cân / tăng cơ', posture: 'Chỉnh dáng', rehab: 'Phục hồi chức năng', kids: 'Trẻ em' }
const TAG_VI: Record<string, string> = { rehab: 'phục hồi', posture: 'chỉnh dáng', kids: 'trẻ em' }

export function buildPrompt(answers: WorkoutAnswers, ctx: ClientContext, library: LibraryExercise[]) {
  const refToEx = new Map<string, LibraryExercise>()
  const lines = library.map((e, i) => {
    const ref = `E${i + 1}`
    refToEx.set(ref, e)
    return `${ref} | ${e.name} | ${e.muscle_group ?? '-'} | ${e.equipment ?? '-'} | ${e.tags.map((t) => TAG_VI[t] ?? t).join(', ') || '-'}`
  })
  const profile = [
    `- Mục tiêu: ${ctx.goals.map((g) => GOAL_VI[g]).join(', ') || 'Khoẻ chung'}`,
    `- Giới tính: ${ctx.gender === 'male' ? 'Nam' : 'Nữ'}${ctx.age !== null ? ` · ${ctx.age} tuổi` : ''}${ctx.isKid ? ' · TRẺ EM' : ''}`,
    `- Trình độ: ${LEVEL_BRIEF[answers.level]}`,
    `- Số buổi mỗi tuần: ${answers.sessionsPerWeek} · khoảng ${answers.sessionMinutes} phút/buổi`,
    `- Dụng cụ: ${EQUIP_BRIEF[answers.equipment]}`,
    `- Nhóm cơ ưu tiên: ${answers.focusMuscles.join(', ') || 'cân đối'}`,
    `- Tiền sử sức khoẻ / hạn chế: ${ctx.healthText || 'không ghi nhận'}`,
    answers.notes ? `- Ghi chú của PT: ${answers.notes}` : null,
    answers.name ? `- Tên giáo án (dùng đúng): ${answers.name}` : '- Tên giáo án: đặt tên ngắn bằng tiếng Việt theo mục tiêu',
  ].filter(Boolean).join('\n')
  const prompt = ['HỒ SƠ KHÁCH', profile, '', 'THƯ VIỆN BÀI TẬP (mã | tên | nhóm cơ | dụng cụ | nhãn)', lines.join('\n'), '', 'Thiết kế tuần tập mẫu ngay.'].join('\n')
  return { system: SYSTEM, prompt, refToEx }
}

/** Cắt ở ranh giới từ (không cắt giữa chữ) */
function shortLabel(s: string, max: number) {
  if (s.length <= max) return s
  const cut = s.slice(0, max + 1).replace(/\s+\S*$/, '')
  return (cut || s.slice(0, max)).replace(/[\s&,:–-]+$/, '')
}

/** Biến câu trả lời (không tin cậy) của AI thành danh sách buổi hợp lệ. */
export function sanitizePlan(raw: unknown, refToEx: Map<string, LibraryExercise>, sessions: number) {
  const root = (raw && typeof raw === 'object' ? raw : {}) as { name?: unknown; days?: unknown }
  let dropped = 0
  const days: PlanDay[] = []
  for (const d of (Array.isArray(root.days) ? root.days : []).slice(0, sessions)) {
    const day = (d && typeof d === 'object' ? d : {}) as { label?: unknown; exercises?: unknown }
    const seen = new Set<string>()
    const exercises: PlanExercise[] = []
    for (const r of (Array.isArray(day.exercises) ? day.exercises : []).slice(0, 10)) {
      const e = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
      const ex = refToEx.get(String(e.ref ?? '').trim().toUpperCase())
      if (!ex) { dropped++; continue }
      if (seen.has(ex.id)) continue
      seen.add(ex.id)
      const dur = clampInt(e.duration_sec, 0, 900, 0)
      const reps = txt(e.reps, 12).replace(/[^\d\-–x ]/g, '').replace('–', '-')
      exercises.push({
        exercise_id: ex.id, name: ex.name, sets: clampInt(e.sets, 1, 6, 3),
        reps: reps || (dur ? null : '10'), duration_sec: dur || null,
        rest_sec: clampInt(e.rest_sec, 15, 300, 60), note: txt(e.note, 150) || null,
      })
    }
    if (exercises.length) days.push({ label: shortLabel(txt(day.label, 200), 40) || `Buổi ${days.length + 1}`, exercises })
  }
  return { name: shortLabel(txt(root.name, 200), 80), days, dropped }
}

// ─── Dự phòng: dựng lịch theo quy tắc khi không có AI ────────────────────────
const CAT: Record<string, RegExp> = {
  legs: /chân|đùi|mông|bắp chân/i, push: /ngực|vai trước|vai giữa|tay sau/i,
  pull: /lưng|vai sau|tay trước|cầu vai/i, core: /bụng|core/i, mobility: /di động|kéo giãn|thăng bằng/i,
}
const SPLITS: Record<number, { label: string; cats: string[] }[]> = {
  1: [{ label: 'Toàn thân', cats: ['legs', 'push', 'pull', 'legs', 'core', 'pull'] }],
  2: [{ label: 'Toàn thân A', cats: ['legs', 'push', 'pull', 'legs', 'core', 'pull'] }, { label: 'Toàn thân B', cats: ['legs', 'pull', 'push', 'legs', 'core', 'push'] }],
  3: [{ label: 'Toàn thân A', cats: ['legs', 'push', 'pull', 'legs', 'core', 'pull'] }, { label: 'Toàn thân B', cats: ['legs', 'pull', 'push', 'legs', 'core', 'push'] }, { label: 'Toàn thân C', cats: ['legs', 'push', 'pull', 'core', 'legs', 'pull'] }],
  4: [{ label: 'Thân dưới A', cats: ['legs', 'legs', 'legs', 'core', 'legs', 'core'] }, { label: 'Thân trên A', cats: ['push', 'pull', 'push', 'pull', 'core', 'pull'] }, { label: 'Thân dưới B', cats: ['legs', 'legs', 'legs', 'core', 'legs', 'core'] }, { label: 'Thân trên B', cats: ['pull', 'push', 'pull', 'push', 'core', 'push'] }],
}
SPLITS[5] = [...SPLITS[4], { label: 'Toàn thân', cats: ['legs', 'push', 'pull', 'core', 'legs', 'pull'] }]
SPLITS[6] = [...SPLITS[3], ...SPLITS[3].map((d) => ({ ...d, label: d.label.replace('Toàn thân', 'Toàn thân 2 –') }))]

export function buildFallbackPlan(answers: WorkoutAnswers, ctx: ClientContext, library: LibraryExercise[]): PlanDay[] {
  const per = Math.max(3, Math.min(8, Math.round(answers.sessionMinutes / 11)))
  const special = ctx.goals.includes('rehab') ? 'rehab' : ctx.isKid || ctx.goals.includes('kids') ? 'kids' : ctx.goals.includes('posture') ? 'posture' : null
  const rehab = special === 'rehab', kids = special === 'kids'
  const pool = (cat: string) => {
    const list = library.filter((e) => CAT[cat]?.test(e.muscle_group ?? ''))
    return special ? [...list.filter((e) => e.tags.includes(special)), ...list.filter((e) => !e.tags.includes(special))] : list
  }
  const offset: Record<string, number> = {}
  return (SPLITS[answers.sessionsPerWeek] ?? SPLITS[3]).map((tpl) => {
    const used = new Set<string>()
    const exercises: PlanExercise[] = []
    for (const cat of [...tpl.cats, 'core', 'mobility', 'legs', 'pull']) {
      if (exercises.length >= per) break
      const p = pool(cat)
      for (let k = 0; k < p.length; k++) {
        const e = p[((offset[cat] ?? 0) + k) % p.length]
        if (used.has(e.id)) continue
        used.add(e.id); offset[cat] = ((offset[cat] ?? 0) + k + 1) % p.length
        const hold = /plank|giữ|thăng bằng|kéo giãn|đi bộ|đạp xe/i.test(e.name)
        exercises.push({
          exercise_id: e.id, name: e.name, sets: rehab ? 2 : 3,
          reps: hold ? null : rehab ? '10' : kids ? '10' : ctx.goals.includes('weight_gain') ? '8-12' : '12',
          duration_sec: hold ? (kids ? 30 : 40) : null, rest_sec: rehab ? 60 : ctx.goals.includes('weight_gain') ? 90 : 60,
          note: rehab ? 'Biên độ không đau, kiểm soát chậm' : null,
        })
        break
      }
    }
    return { label: tpl.label, exercises }
  }).filter((d) => d.exercises.length)
}
