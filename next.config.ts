import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Máy build ít RAM: sinh trang tuần tự thay vì song song
  experimental: { cpus: 1 },
  // Logo đính kèm trong email được đọc từ ổ đĩa lúc chạy → phải có trong bản build
  outputFileTracingIncludes: {
    '/api/**': ['./public/brand/logo-512.png'],
  },
  async headers() {
    return [
      {
        // Service worker không được cache, nếu không bản sửa lỗi không tới được máy đã cài app
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
