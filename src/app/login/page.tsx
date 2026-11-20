import type { Metadata } from 'next'
import Image from 'next/image'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Đăng nhập' }

const REASONS: Record<string, string> = {
  'link-het-han': 'Link đăng nhập đã hết hạn hoặc đã được dùng. Vui lòng gửi mã mới.',
  'da-dang-xuat': 'Thiết bị này đã được đăng xuất từ xa. Vui lòng đăng nhập lại.',
  'thiet-bi': 'Thiết bị này cần xác nhận qua email. Vui lòng đăng nhập lại.',
  'tai-khoan': 'Tài khoản không còn hoạt động. Vui lòng liên hệ phòng tập.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const { loi } = await searchParams
  return (
    <main className="pt-safe flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/brand/logo.svg" alt="UR Private Gym" width={128} height={128} priority />
          <h1 className="mt-6 text-2xl font-bold">Đăng nhập</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nhập email đã đăng ký với phòng tập. Chúng tôi sẽ gửi mã đăng nhập — không cần mật khẩu.
          </p>
        </div>
        <LoginForm notice={loi ? REASONS[loi] : undefined} />
      </div>
    </main>
  )
}
