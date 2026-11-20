import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { AppDialogHost } from '@/components/ui/app-dialog'
import './globals.css'

// Be Vietnam Pro: hiển thị đủ dấu tiếng Việt
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'UR Private Gym', template: '%s · UR Private Gym' },
  description: 'Theo dõi lộ trình tập luyện, dinh dưỡng và chỉ số cơ thể cùng HLV UR Private Gym.',
  appleWebApp: { capable: true, title: 'UR Gym', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`dark ${beVietnamPro.variable}`}>
      <body>
        {children}
        <Toaster position="top-center" richColors />
        <InstallPrompt />
        <AppDialogHost />
      </body>
    </html>
  )
}
