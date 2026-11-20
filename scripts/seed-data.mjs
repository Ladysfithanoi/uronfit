// Dữ liệu tĩnh cho dữ liệu mẫu: chỉ số mặc định + 60 bài tập cơ bản.
// Nhãn chống chỉ định dùng chung bộ mã với clients.health_flags (xem src/lib/labels.ts).

export const METRIC_TYPES = [
  // Cân điện tử + thước dây (giảm mỡ, tăng cân; trẻ em dùng chung cân nặng)
  { name: 'Cân nặng',       unit: 'kg', kind: 'number', goal: null,          client_can_enter: true },
  { name: 'Vòng eo',        unit: 'cm', kind: 'number', goal: 'fat_loss',    client_can_enter: true },
  { name: 'Vòng hông',      unit: 'cm', kind: 'number', goal: 'fat_loss',    client_can_enter: true },
  { name: 'Vòng ngực',      unit: 'cm', kind: 'number', goal: 'fat_loss',    client_can_enter: true },
  { name: 'Vòng đùi',       unit: 'cm', kind: 'number', goal: 'fat_loss',    client_can_enter: true },
  { name: 'Vòng bắp tay',   unit: 'cm', kind: 'number', goal: 'fat_loss',    client_can_enter: true },
  // Tuỳ chọn, mặc định TẮT (đã chốt: chỉ có cân điện tử và thước dây)
  { name: '% mỡ',           unit: '%',  kind: 'number', goal: 'fat_loss',    default_enabled: false },
  { name: 'Khối cơ',        unit: 'kg', kind: 'number', goal: 'fat_loss',    default_enabled: false },
  // Chỉnh dáng
  { name: 'Độ lệch vai',        unit: null, kind: 'text', goal: 'posture' },
  { name: 'Độ lệch hông',       unit: null, kind: 'text', goal: 'posture' },
  { name: 'Độ lệch cột sống',   unit: null, kind: 'text', goal: 'posture' },
  // Phục hồi chức năng
  { name: 'Mức đau',                     unit: '/10', kind: 'number', goal: 'rehab' },
  { name: 'Biên độ vận động khớp',       unit: '°',   kind: 'number', goal: 'rehab' },
  { name: 'Khả năng động tác chức năng', unit: null,  kind: 'text',   goal: 'rehab' },
  // Trẻ em
  { name: 'Chiều cao',          unit: 'cm', kind: 'number', goal: 'kids' },
  { name: 'Ghi chú vận động',   unit: null, kind: 'text',   goal: 'kids' },
]

// [tên, nhóm cơ, dụng cụ, nhãn[], chống chỉ định[]]
export const EXERCISES = [
  // Chân – mông
  ['Squat với tạ đơn (Goblet Squat)', 'Chân – mông', 'Tạ đơn', [], ['knee']],
  ['Squat tạ đòn (Back Squat)', 'Chân – mông', 'Tạ đòn', [], ['spine', 'knee']],
  ['Squat với ghế (Box Squat)', 'Chân – mông', 'Ghế', ['rehab', 'kids'], []],
  ['Chùng chân (Lunge)', 'Chân – mông', 'Không dụng cụ', ['kids'], ['knee']],
  ['Chùng chân lùi (Reverse Lunge)', 'Chân – mông', 'Tạ đơn', [], ['knee']],
  ['Bulgarian Split Squat', 'Chân – mông', 'Ghế, tạ đơn', [], ['knee']],
  ['Đạp chân máy (Leg Press)', 'Chân – mông', 'Máy', [], ['knee']],
  ['Romanian Deadlift', 'Đùi sau – mông', 'Tạ đòn', [], ['spine']],
  ['Deadlift tạ đòn', 'Đùi sau – mông', 'Tạ đòn', [], ['spine']],
  ['Hip Thrust', 'Mông', 'Tạ đòn, ghế', [], []],
  ['Glute Bridge', 'Mông', 'Thảm', ['rehab', 'posture', 'kids'], []],
  ['Glute Bridge một chân', 'Mông', 'Thảm', ['rehab', 'posture'], []],
  ['Đá hông với dây (Cable Kickback)', 'Mông', 'Cáp', [], []],
  ['Mở hông với dây mini band (Clamshell)', 'Mông nhỡ', 'Dây kháng lực', ['rehab', 'posture'], []],
  ['Bước ngang với dây (Lateral Band Walk)', 'Mông nhỡ', 'Dây kháng lực', ['rehab', 'posture', 'kids'], []],
  ['Gập chân máy (Leg Curl)', 'Đùi sau', 'Máy', [], []],
  ['Duỗi chân máy (Leg Extension)', 'Đùi trước', 'Máy', [], ['knee']],
  ['Bước lên bục (Step-up)', 'Chân – mông', 'Bục', ['kids', 'rehab'], []],
  ['Nhón bắp chân (Calf Raise)', 'Bắp chân', 'Không dụng cụ', ['kids'], []],
  // Lưng
  ['Kéo xô máy (Lat Pulldown)', 'Lưng', 'Máy cáp', [], ['shoulder']],
  ['Chèo cáp ngồi (Seated Cable Row)', 'Lưng', 'Máy cáp', ['posture'], []],
  ['Chèo tạ đơn một tay', 'Lưng', 'Tạ đơn, ghế', [], []],
  ['Chèo tạ đòn gập người (Bent-over Row)', 'Lưng', 'Tạ đòn', [], ['spine']],
  ['Kéo xà hỗ trợ (Assisted Pull-up)', 'Lưng', 'Máy hỗ trợ', [], ['shoulder']],
  ['Face Pull', 'Vai sau – lưng trên', 'Cáp / dây', ['posture', 'rehab'], []],
  ['Kéo dây ra sau (Band Pull-apart)', 'Vai sau – lưng trên', 'Dây kháng lực', ['posture', 'rehab'], []],
  ['Superman', 'Lưng dưới', 'Thảm', ['kids'], ['spine']],
  ['Bird Dog', 'Core – lưng dưới', 'Thảm', ['rehab', 'posture', 'kids'], []],
  // Ngực – vai – tay
  ['Đẩy ngực tạ đơn (Dumbbell Bench Press)', 'Ngực', 'Tạ đơn, ghế', [], ['shoulder']],
  ['Đẩy ngực tạ đòn (Bench Press)', 'Ngực', 'Tạ đòn, ghế', [], ['shoulder']],
  ['Hít đất (Push-up)', 'Ngực', 'Không dụng cụ', ['kids'], ['wrist']],
  ['Hít đất tựa tường / ghế (Incline Push-up)', 'Ngực', 'Ghế', ['rehab', 'kids'], []],
  ['Ép ngực cáp (Cable Fly)', 'Ngực', 'Cáp', [], ['shoulder']],
  ['Đẩy vai tạ đơn (Shoulder Press)', 'Vai', 'Tạ đơn', [], ['shoulder', 'spine']],
  ['Dang vai tạ đơn (Lateral Raise)', 'Vai', 'Tạ đơn', [], ['shoulder']],
  ['Xoay vai ngoài với dây (External Rotation)', 'Vai – chóp xoay', 'Dây kháng lực', ['rehab', 'posture'], []],
  ['Cuốn tạ tay trước (Biceps Curl)', 'Tay trước', 'Tạ đơn', [], []],
  ['Duỗi tay sau với cáp (Triceps Pushdown)', 'Tay sau', 'Cáp', [], []],
  ['Chống đẩy tay sau trên ghế (Bench Dip)', 'Tay sau', 'Ghế', [], ['shoulder', 'wrist']],
  // Core
  ['Plank', 'Core', 'Thảm', ['rehab', 'posture', 'kids'], []],
  ['Plank nghiêng (Side Plank)', 'Core', 'Thảm', ['posture'], []],
  ['Dead Bug', 'Core', 'Thảm', ['rehab', 'posture', 'kids'], []],
  ['Gập bụng (Crunch)', 'Bụng', 'Thảm', [], ['spine']],
  ['Nâng chân nằm (Leg Raise)', 'Bụng dưới', 'Thảm', [], ['spine']],
  ['Xoay người Nga (Russian Twist)', 'Bụng chéo', 'Thảm, tạ', [], ['spine']],
  ['Pallof Press', 'Core chống xoay', 'Cáp / dây', ['rehab', 'posture'], []],
  ['Leo núi (Mountain Climber)', 'Core – tim mạch', 'Không dụng cụ', ['kids'], ['wrist']],
  // Tim mạch – vận động
  ['Đi bộ dốc máy chạy', 'Tim mạch', 'Máy chạy', ['rehab'], []],
  ['Đạp xe tại chỗ', 'Tim mạch', 'Xe đạp tập', ['rehab'], []],
  ['Nhảy dây', 'Tim mạch', 'Dây nhảy', ['kids'], ['knee']],
  ['Bật nhảy Jumping Jack', 'Tim mạch', 'Không dụng cụ', ['kids'], ['knee']],
  ['Burpee', 'Toàn thân', 'Không dụng cụ', [], ['knee', 'wrist', 'spine']],
  ['Swing tạ ấm (Kettlebell Swing)', 'Đùi sau – mông', 'Tạ ấm', [], ['spine']],
  ['Bò gấu (Bear Crawl)', 'Toàn thân', 'Không dụng cụ', ['kids'], ['wrist']],
  // Di động – kéo giãn – chỉnh dáng
  ['Mèo – bò (Cat-Cow)', 'Di động cột sống', 'Thảm', ['rehab', 'posture', 'kids'], []],
  ['Tư thế em bé (Child’s Pose)', 'Kéo giãn lưng', 'Thảm', ['rehab', 'posture'], []],
  ['Kéo giãn cơ gập hông', 'Kéo giãn hông', 'Thảm', ['rehab', 'posture'], []],
  ['Thiên thần áp tường (Wall Angel)', 'Vai – cột sống ngực', 'Tường', ['posture', 'rehab'], []],
  ['Lăn cột sống ngực với foam roller', 'Di động cột sống ngực', 'Foam roller', ['posture', 'rehab'], []],
  ['Thăng bằng một chân', 'Thăng bằng', 'Không dụng cụ', ['kids', 'rehab'], []],
]

// Mô tả hiển thị cho từng nhãn chống chỉ định (khớp src/lib/labels.ts)
export const CONTRA_LABELS = {
  spine: 'Cột sống / thoát vị đĩa đệm',
  knee: 'Khớp gối',
  shoulder: 'Khớp vai',
  hip: 'Khớp háng',
  wrist: 'Cổ tay',
}
