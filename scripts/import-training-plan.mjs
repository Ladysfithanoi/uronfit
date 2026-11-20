// Nhập thư viện bài tập từ app training-plan (project Supabase khác) vào app này.
//
//   npm run import:exercises                      — đọc D:/Apps/training-plan/.env.local
//   npm run import:exercises -- <đường-dẫn-.env>  — dùng file env khác
//
// • Chỉ ĐỌC từ training-plan, không ghi gì bên đó.
// • Chạy lại nhiều lần an toàn: bài đã có (trùng tên, kể cả tên tiếng Anh trong ngoặc
//   của bài sẵn có) thì không nhập lại — chỉ bổ sung link video nếu bài hiện tại chưa có.
// • Nhãn chống chỉ định "cột sống" được gắn tự động cho bài dồn tải lên cột sống;
//   PT/FM nên rà lại trong Thư viện.
import fs from 'node:fs'
import { config, parse } from 'dotenv'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })
const envPath = process.argv[2] ?? 'D:/Apps/training-plan/.env.local'
if (!fs.existsSync(envPath)) { console.error(`Không tìm thấy ${envPath}`); process.exit(1) }
const src = parse(fs.readFileSync(envPath))
const tp = createClient(src.NEXT_PUBLIC_SUPABASE_URL, src.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const MUSCLE = {
  glutes: 'Mông', quads: 'Đùi trước', hamstrings: 'Đùi sau', hamstring: 'Đùi sau', adductors: 'Đùi trong', abductors: 'Mông nhỡ',
  calves: 'Bắp chân', chest: 'Ngực', lats: 'Lưng xô', mid_back: 'Lưng giữa', 'lưng trên': 'Lưng trên', traps: 'Cầu vai', erectors: 'Lưng dưới',
  front_delt: 'Vai trước', side_delt: 'Vai giữa', lateral_delt: 'Vai giữa', rear_delt: 'Vai sau', external_rotators: 'Vai – chóp xoay',
  biceps: 'Tay trước', brachialis: 'Tay trước', triceps: 'Tay sau', forearm_flexors: 'Cẳng tay', abs: 'Bụng', core: 'Core', obliques: 'Bụng chéo',
  fullbody: 'Toàn thân',
}
const PATTERN = { squat: 'Chân – mông', hinge: 'Đùi sau – mông', push: 'Ngực – vai', pull: 'Lưng', lunge: 'Chân – mông', carry: 'Toàn thân', core: 'Core', isolation: null }
const TYPE_EQUIP = { machine: 'Máy', cable: 'Cáp', dumbbell: 'Tạ đơn', bodyweight: 'Không dụng cụ', resistance_band: 'Dây kháng lực' }

function equipment(name, type) {
  const n = name.toLowerCase()
  if (/smith/.test(n)) return 'Máy Smith'
  if (/\bkb\b|kettlebell/.test(n)) return 'Tạ ấm'
  if (/cable/.test(n)) return 'Cáp'
  if (/band(ed)?\b/.test(n)) return 'Dây kháng lực'
  if (/\bdb\b|dumbbell/.test(n)) return 'Tạ đơn'
  if (/machine|leg press|pec deck|hack squat/.test(n)) return 'Máy'
  if (/\bbb\b|barbell|trap bar|ez/.test(n)) return 'Tạ đòn'
  return TYPE_EQUIP[type] ?? 'Tạ đòn / tạ tự do'
}

// Nhóm cơ đoán theo tên khi training-plan để trống (thứ tự: cụ thể trước, chung sau)
const NAME_MUSCLE = [
  [/leg curl|nordic|hamstring/, 'Đùi sau'], [/leg extension|sissy/, 'Đùi trước'], [/calf/, 'Bắp chân'],
  [/hip thrust|glute|kickback|abduct|clam/, 'Mông'], [/adduct/, 'Đùi trong'],
  [/rdl|romanian|deadlift|good ?morning|swing|hinge/, 'Đùi sau – Mông'],
  [/squat|lunge|split|step[- ]?up|leg press/, 'Chân – Mông'],
  [/rear delt|reverse fly|face pull|pull[- ]?apart/, 'Vai sau'], [/lateral raise|side raise|upright row/, 'Vai giữa'],
  [/overhead press|shoulder press|ohp|military|arnold|front raise/, 'Vai trước'],
  [/wrist|plate pinch|grip|holds?\b|farmer/, 'Cẳng tay – cầm nắm'],
  [/curl/, 'Tay trước'], [/tricep|pushdown|skull|kickback|dip|overhead.*extension/, 'Tay sau'],
  [/bench|chest|push[- ]?up|fly|pec|incline.*press|floor press/, 'Ngực'],
  [/run|high knee|butt kick|butt touch|jog|bike|đạp xe|jumping jack|skip/, 'Tim mạch – khởi động'],
  [/inch ?worm|crawl|burpee/, 'Toàn thân'],
  [/pulldown|pull[- ]?up|chin[- ]?up|lat /, 'Lưng xô'], [/row/, 'Lưng giữa'], [/shrug/, 'Cầu vai'],
  [/plank|crunch|sit[- ]?up|ab |abs|leg raise|dead ?bug|pallof|twist|hollow|core/, 'Bụng'],
]
const muscleFromName = (name) => NAME_MUSCLE.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? null

// Biến thể theo giáo án của training-plan (Back Off, Topset, AMRAP…) — không đưa vào thư viện
const isProgramVariant = (name) => /\((back ?off|top ?set|amrap|reset)[^)]*\)/i.test(name)

// Bài dồn tải trực tiếp lên cột sống → cảnh báo với khách có tiền sử cột sống / thoát vị
function contraindications(name) {
  const n = name.toLowerCase()
  const out = []
  if (/deadlift|good ?morning|back squat|\bbb\b.*squat|barbell squat|bent[- ]?over.*row|pendlay|sit[- ]?up|crunch|russian twist|toes to bar|leg raise|jefferson|zercher/.test(n)
      && !/single[- ]leg|1[- ]leg|b-stance/.test(n)) out.push('spine')
  if (/jump|plyo|box jump|bound|depth/.test(n)) out.push('knee')
  return out
}

const key = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const fm = (await db.query("select id from profiles where role = 'fm' limit 1")).rows[0]?.id ?? null
const existing = (await db.query('select id, name, video_url from exercises')).rows
const index = new Map()
for (const e of existing) {
  index.set(key(e.name), e)
  const en = e.name.match(/\(([^)]+)\)/)?.[1]
  if (en) index.set(key(en), e)
}

const { data, error } = await tp.from('exercises').select('name, type, muscle_groups, description, video_url, movement_patterns(name)').order('name')
if (error) { console.error('Không đọc được thư viện training-plan:', error.message); process.exit(1) }

let added = 0, videos = 0, skipped = 0, variants = 0
for (const e of data) {
  const name = e.name.trim()
  if (isProgramVariant(name)) { variants++; continue }
  const hit = index.get(key(name))
  if (hit) {
    if (!hit.video_url && e.video_url) { await db.query('update exercises set video_url = $1 where id = $2', [e.video_url, hit.id]); hit.video_url = e.video_url; videos++ }
    else skipped++
    continue
  }
  const groups = (e.muscle_groups ?? []).map((g) => MUSCLE[g.toLowerCase()] ?? null).filter(Boolean)
  const raw = [...new Set(groups)].slice(0, 2).join(' – ') || muscleFromName(name)
    || PATTERN[(e.movement_patterns?.name ?? '').toLowerCase()] || null
  // Cùng kiểu viết với thư viện gốc: chỉ hoa chữ đầu ("Đùi sau – mông")
  const muscle = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : null
  const row = (await db.query(
    `insert into exercises (name, muscle_group, equipment, description, video_url, tags, contraindications, created_by)
     values ($1,$2,$3,$4,$5,'{}',$6,$7) returning id, name, video_url`,
    [name, muscle, equipment(name, e.type), e.description || null, e.video_url || null, contraindications(name), fm])).rows[0]
  index.set(key(name), row)
  added++
}
await db.end()
console.log(`✓ Đọc ${data.length} bài từ training-plan: thêm mới ${added}, bổ sung video cho ${videos} bài có sẵn, bỏ qua ${skipped} bài trùng và ${variants} biến thể giáo án.`)
