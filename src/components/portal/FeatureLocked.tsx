import { Lock } from 'lucide-react'

/** Tính năng không có trong gói dịch vụ của khách */
export function FeatureLocked({ feature, tierName }: { feature: string; tierName?: string | null }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <Lock className="size-8 text-muted-foreground" />
      <p className="mt-3 font-semibold">{feature} chưa có trong gói của bạn</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {tierName ? <>Bạn đang dùng gói <b className="text-foreground">{tierName}</b>. </> : null}
        Liên hệ phòng tập hoặc HLV để nâng cấp gói và dùng tính năng này.
      </p>
    </div>
  )
}
