// Nạp dữ liệu mẫu để demo: 1 FM, 2 PT, 8 khách (đủ nhóm mục tiêu), 1 nhóm 1:2,
// 1 nhóm trẻ em (3 bé, 2 phụ huynh), 60 bài tập, bộ chỉ số mặc định.
//
//   npm run db:seed            — nạp vào cơ sở dữ liệu trống
//   npm run db:seed -- --reset — XOÁ toàn bộ dữ liệu + tài khoản demo rồi nạp lại
//
// Email tài khoản demo dùng "Gmail +": <ten>+pt1@gmail.com ... đều về chung một
// hộp thư SEED_EMAIL (mặc định = GMAIL_USER), nên đăng nhập thử được mọi vai trò.
// FM_EMAIL: email thật của FM (chị chủ); bỏ trống thì dùng chính hộp thư SEED_EMAIL / GMAIL_USER.
import { config } from 'dotenv'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { METRIC_TYPES, EXERCISES } from './seed-data.mjs'

config({ path: '.env.local', quiet: true })

const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const base = process.env.SEED_EMAIL || process.env.GMAIL_USER
if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Thiếu DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env.local')
  process.exit(1)
}
if (!base || !base.includes('@')) {
  console.error('Thiếu SEED_EMAIL hoặc GMAIL_USER trong .env.local (dùng làm hộp thư cho tài khoản demo).')
  process.exit(1)
}
const [local, domain] = base.split('@')
const demoEmail = (tag) => `${local}+${tag}@${domain}`.toLowerCase()

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const db = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const q = (sql, params) => db.query(sql, params)
const one = async (sql, params) => (await q(sql, params)).rows[0]

const reset = process.argv.includes('--reset')

// ─── Xoá dữ liệu cũ ─────────────────────────────────────────────────────────
const { rows: [{ n }] } = await q('select count(*)::int as n from clients')
if (n > 0 && !reset) {
  console.error('Cơ sở dữ liệu đã có khách hàng. Chạy lại với --reset để xoá và nạp lại dữ liệu mẫu.')
  process.exit(1)
}
if (reset) {
  await q(`truncate clients, groups, exercises, metric_types, devices, login_requests,
           workout_plans, meal_plans restart identity cascade`)
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users.filter((u) => u.user_metadata?.demo)) {
    await admin.auth.admin.deleteUser(u.id)
  }
  console.log('· đã xoá dữ liệu và tài khoản demo cũ')
}

// ─── Tài khoản ──────────────────────────────────────────────────────────────
async function account(email, full_name, role, created_by = null, phone = null) {
  let id
  const { data, error } = await admin.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { demo: true, full_name },
  })
  if (error) {
    // đã tồn tại (vd FM thật giữ lại) → tìm lại id
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email?.toLowerCase() === email)?.id
    if (!id) throw error
  } else id = data.user.id
  await q(`insert into profiles (id, full_name, role, email, phone, created_by)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (id) do update set full_name = excluded.full_name, role = excluded.role`,
    [id, full_name, role, email, phone, created_by])
  return id
}

const fmEmail = (process.env.FM_EMAIL || base).toLowerCase()
const fm  = await account(fmEmail, 'Quản lý UR Gym', 'fm')
const pt1 = await account(demoEmail('pt1'), 'HLV Ngọc Lan', 'pt', fm, '0901000001')
const pt2 = await account(demoEmail('pt2'), 'HLV Minh Khoa', 'pt', fm, '0901000002')

// ─── Khách hàng ─────────────────────────────────────────────────────────────
async function client(c) {
  const row = await one(
    `insert into clients (full_name, gender, birth_date, phone, start_date, goals, training_type,
       pt_id, status, injuries, surgeries, joint_conditions, doctor_orders, avoid_movements,
       health_flags, is_kid, guardian_name, guardian_phone, height_cm, kid_notes, created_by)
     values ($1,$2,$3,$4,$5,$6::goal_group[],$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     returning id`,
    [c.name, c.gender, c.birth, c.phone ?? null, c.start, c.goals, c.type, c.pt, c.status ?? 'active',
     c.injuries ?? null, c.surgeries ?? null, c.joints ?? null, c.doctor ?? null, c.avoid ?? null,
     c.flags ?? [], c.kid ?? false, c.gName ?? null, c.gPhone ?? null, c.height ?? null,
     c.kidNotes ?? null, c.pt])
  await q(`insert into client_packages (client_id, name, total_sessions, used_sessions, start_date)
           values ($1,$2,$3,$4,$5)`, [row.id, c.pkg[0], c.pkg[1], c.pkg[2], c.start])
  return row.id
}

const ha = await client({ name: 'Nguyễn Thu Hà', height: 160, gender: 'female', birth: '1994-03-12', phone: '0912000001',
  start: '2026-09-01', goals: ['fat_loss'], type: 'one_on_one', pt: pt1, pkg: ['Gói 36 buổi', 36, 14] })
const maiAnh = await client({ name: 'Trần Mai Anh', height: 158, gender: 'female', birth: '2001-07-25', phone: '0912000002',
  start: '2026-10-01', goals: ['weight_gain'], type: 'one_on_two', pt: pt1, pkg: ['Gói 24 buổi', 24, 6] })
const tram = await client({ name: 'Lê Ngọc Trâm', height: 162, gender: 'female', birth: '1999-11-02', phone: '0912000003',
  start: '2026-10-01', goals: ['fat_loss', 'posture'], type: 'one_on_two', pt: pt1, pkg: ['Gói 24 buổi', 24, 6],
  joints: 'Lệch hông phải nhẹ', avoid: 'Hạn chế bài một chân tạ nặng giai đoạn đầu' })
const hong = await client({ name: 'Phạm Thị Hồng', height: 155, gender: 'female', birth: '1986-05-18', phone: '0912000004',
  start: '2026-08-15', goals: ['rehab'], type: 'one_on_one', pt: pt2, pkg: ['Gói 24 buổi', 24, 22],
  injuries: 'Đau thắt lưng mạn tính', joints: 'Thoát vị đĩa đệm L4–L5',
  doctor: 'Tránh tải nén cột sống, không gập bụng. Tái khám 3 tháng/lần.',
  avoid: 'Deadlift, squat tạ đòn, gập bụng, xoay thân có tải', flags: ['spine'] })
const huy = await client({ name: 'Đỗ Quang Huy', height: 172, gender: 'male', birth: '1997-01-09', phone: '0912000005',
  start: '2026-09-20', goals: ['posture'], type: 'one_on_one', pt: pt2, pkg: ['Gói 24 buổi', 24, 9],
  joints: 'Vai trái cao hơn vai phải, gù lưng trên', surgeries: 'Mổ nội soi gối phải 2023',
  avoid: 'Bật nhảy cường độ cao', flags: ['knee'] })
const na = await client({ name: 'Bé Nguyễn Gia Na', gender: 'female', birth: '2017-04-02', start: '2026-10-05',
  goals: ['kids'], type: 'kids_group', pt: pt2, kid: true, gName: 'Nguyễn Thị Thu', gPhone: '0933000001',
  height: 132, kidNotes: 'Bé hơi nhút nhát, thích vận động theo nhạc', pkg: ['Gói trẻ em 16 buổi', 16, 5] })
const bin = await client({ name: 'Bé Nguyễn Gia Bin', gender: 'male', birth: '2018-08-21', start: '2026-10-05',
  goals: ['kids'], type: 'kids_group', pt: pt2, kid: true, gName: 'Nguyễn Thị Thu', gPhone: '0933000001',
  height: 126, kidNotes: 'Năng động, cần nhắc giữ tư thế', pkg: ['Gói trẻ em 16 buổi', 16, 5] })
const su = await client({ name: 'Bé Trần Bảo Su', gender: 'female', birth: '2016-12-11', start: '2026-10-05',
  goals: ['kids'], type: 'kids_group', pt: pt2, kid: true, gName: 'Trần Văn Long', gPhone: '0933000002',
  height: 138, kidNotes: 'Bàn chân bẹt nhẹ', pkg: ['Gói trẻ em 16 buổi', 16, 14] })

// ─── Tài khoản khách / phụ huynh (PT tạo) ───────────────────────────────────
async function link(clientIds, email, name, role, pt, relation) {
  const id = await account(email, name, role, pt)
  for (const cid of clientIds) {
    await q('insert into client_access (client_id, profile_id, relation) values ($1,$2,$3)', [cid, id, relation])
  }
}
await link([ha], demoEmail('ha'), 'Nguyễn Thu Hà', 'client', pt1, 'self')
await link([maiAnh], demoEmail('maianh'), 'Trần Mai Anh', 'client', pt1, 'self')
await link([tram], demoEmail('tram'), 'Lê Ngọc Trâm', 'client', pt1, 'self')
await link([hong], demoEmail('hong'), 'Phạm Thị Hồng', 'client', pt2, 'self')
await link([huy], demoEmail('huy'), 'Đỗ Quang Huy', 'client', pt2, 'self')
await link([na, bin], demoEmail('phuhuynh1'), 'Nguyễn Thị Thu', 'guardian', pt2, 'guardian')
await link([su], demoEmail('phuhuynh2'), 'Trần Văn Long', 'guardian', pt2, 'guardian')

// ─── Nhóm ───────────────────────────────────────────────────────────────────
const g12 = await one(`insert into groups (name, type, pt_id) values ('Nhóm 1:2 Mai Anh – Trâm','one_on_two',$1) returning id`, [pt1])
await q('insert into group_members values ($1,$2),($1,$3)', [g12.id, maiAnh, tram])
const gKids = await one(`insert into groups (name, type, pt_id) values ('Nhóm trẻ em thứ 7','kids',$1) returning id`, [pt2])
await q('insert into group_members values ($1,$2),($1,$3),($1,$4)', [gKids.id, na, bin, su])

// ─── Lộ trình ───────────────────────────────────────────────────────────────
async function phase(cid, order, name, goal, start, end, targets, status) {
  await q(`insert into phases (client_id, sort_order, name, goal, start_date, end_date, targets, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`, [cid, order, name, goal, start, end, targets, status])
}
await phase(ha, 1, 'Giai đoạn 1 – Làm quen', 'Kỹ thuật nền tảng, tạo thói quen', '2026-09-01', '2026-09-30', 'Giảm 2 kg; tập đủ 3 buổi/tuần', 'completed')
await phase(ha, 2, 'Giai đoạn 2 – Giảm mỡ', 'Tăng cường độ, thâm hụt calo vừa phải', '2026-10-01', '2026-11-30', 'Giảm thêm 3 kg; vòng eo −4 cm', 'active')
await phase(ha, 3, 'Giai đoạn 3 – Duy trì', 'Giữ cân, tăng sức mạnh', '2026-12-01', '2027-01-31', 'Giữ cân ±1 kg', 'planned')
await phase(maiAnh, 1, 'Giai đoạn 1 – Tăng cân sạch', 'Tăng khối cơ, ăn dư calo nhẹ', '2026-10-01', '2026-12-31', 'Tăng 2 kg', 'active')
await phase(tram, 1, 'Giai đoạn 1 – Giảm mỡ & cân bằng hông', 'Giảm mỡ, kích hoạt mông nhỡ', '2026-10-01', '2026-12-31', 'Giảm 2 kg; giảm lệch hông', 'active')
await phase(hong, 1, 'Giai đoạn 1 – Giảm đau', 'Ổn định core, giảm đau thắt lưng', '2026-08-15', '2026-10-15', 'Đau lưng ≤ 4/10', 'completed')
await phase(hong, 2, 'Giai đoạn 2 – Phục hồi vận động', 'Tăng biên độ, sức bền core', '2026-10-16', '2026-12-31', 'Đau lưng ≤ 2/10', 'active')
await phase(huy, 1, 'Giai đoạn 1 – Chỉnh tư thế', 'Cân bằng vai, mở ngực', '2026-09-20', '2026-12-20', 'Giảm chênh vai; bớt gù', 'active')
for (const kid of [na, bin, su]) {
  await phase(kid, 1, 'Học kỳ 1 – Vận động cơ bản', 'Thăng bằng, phối hợp, sức bền', '2026-10-05', '2027-01-15', 'Hoàn thành 16 buổi', 'active')
}

// ─── Ghi chú: 1 ghi chú nội bộ + 1 ghi chú khách xem được ───────────────────
await q(`insert into notes (client_id, content, coach_only, author_id) values
  ($1, 'Khách có tiền sử thoát vị L4–L5: tuyệt đối không cho tải nén cột sống.', true, $2),
  ($1, 'Nhớ ngủ đủ 7 tiếng và uống 2 lít nước mỗi ngày nhé!', false, $2)`, [hong, pt2])

// ─── Chỉ số mặc định ────────────────────────────────────────────────────────
for (const [i, m] of METRIC_TYPES.entries()) {
  await q(`insert into metric_types (name, unit, kind, goal, is_default, default_enabled, client_can_enter, sort_order)
           values ($1,$2,$3,$4,true,$5,$6,$7)`,
    [m.name, m.unit, m.kind, m.goal, m.default_enabled ?? true, m.client_can_enter ?? false, i + 1])
}

// ─── 60 bài tập (chỉ tên + phân loại; ảnh/video phòng tập bổ sung sau) ──────
for (const [name, muscle, equip, tags, contra] of EXERCISES) {
  await q(`insert into exercises (name, muscle_group, equipment, tags, contraindications, created_by)
           values ($1,$2,$3,$4,$5,$6)`, [name, muscle, equip, tags, contra, fm])
}

// ─── Dữ liệu demo bước 3–6 ──────────────────────────────────────────────────
const metricId = async (name) => (await one('select id from metric_types where name = $1 and client_id is null', [name])).id
const exId = async (name) => (await one('select id from exercises where name = $1', [name])).id
const phaseOf = async (cid, order) => (await one('select id from phases where client_id = $1 and sort_order = $2', [cid, order])).id

// Số đo Thu Hà: 3 lần, trải qua 2 giai đoạn (kiểm tra biểu đồ + vạch giai đoạn + so sánh đầu/cuối)
const haP1 = await phaseOf(ha, 1), haP2 = await phaseOf(ha, 2)
const M = { w: await metricId('Cân nặng'), eo: await metricId('Vòng eo'), hong: await metricId('Vòng hông'), dui: await metricId('Vòng đùi') }
const haMeasures = [
  ['2026-09-02', haP1, { w: 64.8, eo: 78, hong: 98, dui: 57 }],
  ['2026-09-29', haP1, { w: 63.1, eo: 76, hong: 97, dui: 56 }],
  ['2026-10-15', haP2, { w: 62.4, eo: 75, hong: 96, dui: 55.5 }],
  ['2026-11-12', haP2, { w: 61.2, eo: 73, hong: 95, dui: 54.5 }],
]
for (const [date, pid, vals] of haMeasures) {
  for (const [k, v] of Object.entries(vals)) {
    await q(`insert into measurements (client_id, phase_id, metric_type_id, measured_on, value_num, measured_by, source)
             values ($1,$2,$3,$4,$5,$6,'staff')`, [ha, pid, M[k], date, v, pt1])
  }
}
// Khách tự nhập một lần cân
await q(`insert into measurements (client_id, phase_id, metric_type_id, measured_on, value_num, measured_by, source)
         values ($1,$2,$3,'2026-11-18',60.9,(select profile_id from client_access where client_id=$1 and relation='self'),'client')`, [ha, haP2, M.w])
// Thị Hồng: mức đau
const pain = await metricId('Mức đau')
for (const [d, v, order] of [['2026-08-16', 7, 1], ['2026-10-10', 4, 1], ['2026-11-10', 3, 2]]) {
  await q(`insert into measurements (client_id, phase_id, metric_type_id, measured_on, value_num, measured_by, source) values ($1,$2,$3,$4,$5,$6,'staff')`,
    [hong, await phaseOf(hong, order), pain, d, v, pt2])
}

// Giáo án 4 tuần × 3 buổi cho Thu Hà, giai đoạn 2 — đã chia sẻ, đã xong vài buổi
const dayPlan = [
  ['Thân dưới', [['Squat với tạ đơn (Goblet Squat)', 3, '12', 12], ['Romanian Deadlift', 3, '10', 20], ['Hip Thrust', 3, '12', 30], ['Plank', 3, null, null, 40]]],
  ['Thân trên', [['Kéo xô máy (Lat Pulldown)', 3, '12', 25], ['Đẩy ngực tạ đơn (Dumbbell Bench Press)', 3, '10', 8], ['Chèo cáp ngồi (Seated Cable Row)', 3, '12', 20], ['Dead Bug', 3, '10']]],
  ['Toàn thân + tim mạch', [['Bước lên bục (Step-up)', 3, '10', 6], ['Hít đất tựa tường / ghế (Incline Push-up)', 3, '12'], ['Swing tạ ấm (Kettlebell Swing)', 3, '15', 12], ['Đi bộ dốc máy chạy', 1, null, null, 900]]],
]
const plan = await one(`insert into workout_plans (name, phase_id, created_by, shared_at) values ('Giảm mỡ 4 tuần',$1,$2,now()) returning id`, [haP2, pt1])
const start = new Date('2026-11-03T00:00:00Z')
for (let w = 1; w <= 4; w++) {
  for (const [d, [title, exs]] of dayPlan.entries()) {
    const date = new Date(start); date.setUTCDate(start.getUTCDate() + (w - 1) * 7 + d * 2)
    const iso = date.toISOString().slice(0, 10)
    const done = iso < '2026-11-20'
    const s = await one(`insert into workout_sessions (plan_id, week, day_order, title, scheduled_date, completed_at, completed_by, comment)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [plan.id, w, d + 1, title, iso, done ? `${iso}T10:00:00+07` : null, done ? pt1 : null, done && d === 0 ? 'Kỹ thuật squat tốt hơn, tăng 2 kg tuần sau.' : null])
    for (const [i, [name, sets, reps, kg, dur]] of exs.entries()) {
      await q(`insert into session_exercises (session_id, exercise_id, sort_order, sets, reps, weight_kg, duration_sec, rest_sec)
               values ($1,$2,$3,$4,$5,$6,$7,60)`, [s.id, await exId(name), i + 1, sets, reps, kg ? kg + (w - 1) : null, dur ?? null])
    }
  }
}
// Buổi tập đã hoàn thành → trừ vào gói (trigger chỉ chạy khi UPDATE, dữ liệu mẫu cộng tay)
await q(`update client_packages set used_sessions = used_sessions + (select count(*) from workout_sessions where plan_id=$1 and completed_at is not null) where client_id=$2`, [plan.id, ha])
// Lưu thành mẫu để dùng lại cho khách khác
const tpl = await one(`select clone_workout_plan($1, 'Mẫu giảm mỡ 3 buổi/tuần', null, null, true) as id`, [plan.id])
await q('update workout_plans set created_by = $1 where id = $2', [pt1, tpl.id])

// Thực đơn 1.500 kcal, 2 ngày, cho Thu Hà giai đoạn 2 — đã chia sẻ
const mp = await one(`insert into meal_plans (name, phase_id, kcal, protein_g, carb_g, fat_g, created_by, shared_at)
  values ('Thực đơn 1.500 kcal',$1,1500,110,150,50,$2,now()) returning id`, [haP2, pt1])
const meals = [
  [1, 'Sáng', 'Phở gà ít bánh', '1 bát nhỏ', 380, 'Có thể thay bằng bún gà'],
  [1, 'Trưa', 'Cơm gạo lứt + ức gà áp chảo + rau luộc', '120 g cơm, 150 g gà', 520, null],
  [1, 'Phụ chiều', 'Sữa chua Hy Lạp + 1 quả chuối', '1 hũ', 210, null],
  [1, 'Tối', 'Cá basa hấp + canh rau ngót', '150 g cá', 390, 'Thay cá basa bằng cá lóc cùng khối lượng'],
  [2, 'Sáng', 'Bánh mì nguyên cám + 2 trứng luộc', '1 ổ nhỏ', 400, null],
  [2, 'Trưa', 'Bún bò ít bún, thêm rau', '1 bát', 500, null],
  [2, 'Phụ chiều', 'Táo + 10 hạt hạnh nhân', '1 quả', 180, null],
  [2, 'Tối', 'Đậu phụ sốt cà + rau cải xào', '200 g đậu', 420, null],
]
for (const [i, [day, slot, dish, portion, kcal, notes]] of meals.entries()) {
  await q(`insert into meals (meal_plan_id, day_number, meal_slot, dish, portion, kcal, notes, sort_order) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [mp.id, day, slot, dish, portion, kcal, notes, i])
}

// Giáo án nhóm trẻ em — dùng chung, điểm danh từng bé
const kp = await one(`insert into workout_plans (name, group_id, created_by, shared_at) values ('Vận động cơ bản học kỳ 1',$1,$2,now()) returning id`, [gKids.id, pt2])
const kidEx = ['Bò gấu (Bear Crawl)', 'Thăng bằng một chân', 'Bước ngang với dây (Lateral Band Walk)', 'Bật nhảy Jumping Jack', 'Plank']
for (let w = 1; w <= 2; w++) {
  const iso = `2026-11-${String(8 + (w - 1) * 7).padStart(2, '0')}`
  const s = await one(`insert into workout_sessions (plan_id, week, day_order, title, scheduled_date, completed_at, completed_by)
    values ($1,$2,1,'Buổi thứ 7',$3,$4,$5) returning id`, [kp.id, w, iso, `${iso}T09:30:00+07`, pt2])
  for (const [i, name] of kidEx.entries()) {
    await q(`insert into session_exercises (session_id, exercise_id, sort_order, sets, reps, rest_sec) values ($1,$2,$3,3,'10',45)`, [s.id, await exId(name), i + 1])
  }
  for (const [kid, present] of [[na, true], [bin, true], [su, w === 1]]) {
    await q('insert into attendance (session_id, client_id, present, marked_by) values ($1,$2,$3,$4)', [s.id, kid, present, pt2])
  }
}

await db.end()
console.log(`✓ Đã nạp dữ liệu mẫu: 3 HLV/FM, 8 khách, 2 nhóm, ${EXERCISES.length} bài tập, ${METRIC_TYPES.length} chỉ số.`)
console.log('\nTài khoản đăng nhập (mã đăng nhập gửi về hộp thư ' + base + '):')
console.log(`  FM          ${fmEmail}`)
for (const t of ['pt1', 'pt2', 'ha', 'hong', 'phuhuynh1']) console.log(`  ${t.padEnd(11)} ${demoEmail(t)}`)
