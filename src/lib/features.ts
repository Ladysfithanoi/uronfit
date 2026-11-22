/** Tính năng phía khách hàng — FM bật/tắt theo từng gói dịch vụ (migration 011). */
export const FEATURES = [
  { key: 'workout_view', label: 'Xem giáo án', desc: 'Giáo án HLV đã chia sẻ, tiến độ buổi tập' },
  { key: 'workout_media', label: 'Ảnh & video hướng dẫn', desc: 'Ảnh minh hoạ, video YouTube từng bài' },
  { key: 'self_training', label: 'Tự đánh dấu buổi tự tập', desc: 'Khách tự tick hoàn thành buổi tự tập' },
  { key: 'meal_view', label: 'Xem thực đơn', desc: 'Thực đơn theo ngày, theo bữa' },
  { key: 'metrics_view', label: 'Xem chỉ số & biểu đồ', desc: 'Biểu đồ, lịch sử đo, so sánh giai đoạn' },
  { key: 'metrics_entry', label: 'Tự nhập cân nặng, số đo', desc: 'Khách tự nhập số đo vòng và cân nặng' },
  { key: 'photos_view', label: 'Xem ảnh tiến độ', desc: 'Ảnh trước/sau, ảnh tư thế' },
  { key: 'coach_notes', label: 'Lời nhắn từ HLV', desc: 'Ghi chú HLV cho phép khách xem' },
  { key: 'print_pdf', label: 'In / xuất PDF', desc: 'Nút in giáo án, thực đơn' },
] as const

export type FeatureKey = (typeof FEATURES)[number]['key']
export const ALL_FEATURES = FEATURES.map((f) => f.key) as FeatureKey[]

export type Tier = { id: string; name: string; description: string | null; features: string[]; is_default: boolean; sort_order: number }

/** Gói áp cho khách: gói được gắn, không có → gói mặc định; chưa có gói nào → đủ tính năng */
export function tierFor(tierId: string | null | undefined, tiers: Tier[]): Tier | null {
  return tiers.find((t) => t.id === tierId) ?? tiers.find((t) => t.is_default) ?? null
}

export function featuresOf(tier: Tier | null, tiersExist: boolean): Set<FeatureKey> {
  if (!tier) return new Set(tiersExist ? [] : ALL_FEATURES)
  return new Set(tier.features.filter((f): f is FeatureKey => (ALL_FEATURES as string[]).includes(f)))
}
