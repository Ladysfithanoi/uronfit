import type { ClientStatus, GoalGroup, PhaseStatus, TrainingType, UserRole } from './types'

export const ROLE_LABEL: Record<UserRole, string> = {
  fm: 'Quản lý phòng tập',
  pt: 'Huấn luyện viên',
  client: 'Khách hàng',
  guardian: 'Phụ huynh',
}

export const GOAL_LABEL: Record<GoalGroup, string> = {
  fat_loss: 'Giảm cân / giảm mỡ',
  weight_gain: 'Tăng cân',
  posture: 'Chỉnh dáng',
  rehab: 'Phục hồi chức năng',
  kids: 'Trẻ em',
}

export const TRAINING_TYPE_LABEL: Record<TrainingType, string> = {
  one_on_one: '1:1',
  one_on_two: '1:2',
  kids_group: 'Nhóm trẻ em',
}

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  active: 'Đang tập',
  paused: 'Tạm nghỉ',
  ended: 'Đã kết thúc',
}

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  planned: 'Sắp tới',
  active: 'Đang thực hiện',
  completed: 'Đã hoàn thành',
}

// Nhãn chống chỉ định của bài tập = nhãn tiền sử của khách (clients.health_flags).
// Trùng nhãn → cảnh báo khi thêm bài vào giáo án.
export const HEALTH_FLAG_LABEL: Record<string, string> = {
  spine: 'Cột sống / thoát vị đĩa đệm',
  knee: 'Khớp gối',
  shoulder: 'Khớp vai',
  hip: 'Khớp háng',
  wrist: 'Cổ tay',
}

export const EXERCISE_TAG_LABEL: Record<string, string> = {
  rehab: 'Phục hồi',
  posture: 'Chỉnh dáng',
  kids: 'Trẻ em',
}

/** Trang chủ theo vai trò */
export function homePath(role: UserRole): string {
  if (role === 'fm') return '/fm'
  if (role === 'pt') return '/pt'
  return '/me'
}
