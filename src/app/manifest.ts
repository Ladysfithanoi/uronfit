import type { MetadataRoute } from 'next'

// Cài lên màn hình chính: mở toàn màn hình như app riêng, nền đen theo logo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UR Private Gym',
    short_name: 'UR Gym',
    description: 'Lộ trình tập luyện, thực đơn và chỉ số cơ thể cùng HLV UR Private Gym.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'vi',
    categories: ['health', 'fitness'],
    icons: [
      { src: '/brand/logo.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
