// Nén ảnh ngay trên điện thoại trước khi tải lên (ý từ app Chisu):
// cạnh dài ≤ 1600px, JPEG chất lượng 0.8 → ảnh 4–8MB còn khoảng 200–400KB.
// Chỉ chạy trong trình duyệt.
const MAX_EDGE = 1600
const QUALITY = 0.8

export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Tệp không phải ảnh')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Không đọc được ảnh (định dạng HEIC chưa hỗ trợ trên máy này?)'))
      i.src = url
    })
    let { width, height } = img
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
    width = Math.round(width * scale); height = Math.round(height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', QUALITY))
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Tên file ngẫu nhiên, không chứa tên khách hay thông tin nhạy cảm */
export function randomFileName(ext = 'jpg') {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
}
