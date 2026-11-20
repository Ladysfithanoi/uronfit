import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { formatDateTime } from '@/lib/date'

// Gửi email qua Gmail + App Password (GMAIL_USER, GMAIL_APP_PASSWORD).
// Không dùng hộp thư mặc định của Supabase: nó chỉ gửi được tới thành viên project.

const user = process.env.GMAIL_USER
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')

export const emailConfigured = Boolean(user && pass)

const transporter = emailConfigured
  ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  : null

const FROM = process.env.EMAIL_FROM || (user ? `UR Private Gym <${user}>` : '')

let logoCache: Buffer | null = null
function logo(): Buffer | null {
  if (logoCache) return logoCache
  try {
    logoCache = fs.readFileSync(path.join(process.cwd(), 'public', 'brand', 'logo-512.png'))
  } catch { logoCache = null }
  return logoCache
}

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#000;padding:24px 12px;font-family:'Be Vietnam Pro',Arial,sans-serif;color:#fff">
  <div style="max-width:440px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:16px;padding:28px 24px">
    <div style="text-align:center;margin-bottom:16px"><img src="cid:urlogo" width="88" height="88" alt="UR Private Gym" style="display:inline-block"></div>
    <h1 style="font-size:20px;margin:0 0 12px;text-align:center;color:#fff">${title}</h1>
    ${body}
    <p style="font-size:12px;color:#a0a0a0;margin:24px 0 0;text-align:center;letter-spacing:.12em">UR PRIVATE GYM</p>
  </div></body></html>`
}

async function send(to: string, subject: string, html: string, text: string) {
  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      // Chỉ khi chạy thử trên máy và chưa cấu hình Gmail: in ra console để đăng nhập được.
      console.warn(`[email:dev] Chưa cấu hình Gmail. Gửi tới ${to} — ${subject}\n${text}`)
      return
    }
    throw new Error('Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD')
  }
  const img = logo()
  await transporter.sendMail({
    from: FROM, to, subject, html, text,
    attachments: img ? [{ filename: 'logo.png', content: img, cid: 'urlogo' }] : [],
  })
}

const btn = (href: string, label: string) =>
  `<div style="text-align:center;margin:20px 0"><a href="${href}" style="display:inline-block;background:#FD3786;color:#000;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:16px">${label}</a></div>`

/** Email đăng nhập: mã 6 số + đường link. */
export async function sendLoginEmail(to: string, code: string, link: string) {
  const html = layout('Mã đăng nhập của bạn', `
    <p style="font-size:15px;line-height:1.6;color:#ddd;margin:0 0 16px;text-align:center">Nhập mã dưới đây vào app UR Private Gym:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;background:#000;border:1px solid #FD3786;border-radius:12px;padding:16px 8px;color:#fff">${code}</div>
    <p style="font-size:14px;color:#a0a0a0;text-align:center;margin:20px 0 0">hoặc bấm nút để đăng nhập ngay trên máy này:</p>
    ${btn(link, 'Đăng nhập')}
    <p style="font-size:13px;line-height:1.6;color:#a0a0a0;margin:0">Mã chỉ dùng được một lần và hết hạn sau 60 phút. Nếu đã cài app lên màn hình chính iPhone, hãy <b style="color:#fff">nhập mã</b> thay vì bấm nút.</p>
    <p style="font-size:13px;line-height:1.6;color:#a0a0a0;margin:12px 0 0">Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này — tài khoản của bạn vẫn an toàn.</p>`)
  const text = `Mã đăng nhập UR Private Gym: ${code}\nHoặc mở link: ${link}\nMã chỉ dùng một lần, hết hạn sau 60 phút.`
  await send(to, `${code} là mã đăng nhập UR Private Gym`, html, text)
}

/** Email cảnh báo đăng nhập trên thiết bị mới. */
export async function sendNewDeviceEmail(to: string, name: string, label: string, at: Date, devicesUrl: string) {
  const html = layout('Đăng nhập trên thiết bị mới', `
    <p style="font-size:15px;line-height:1.6;color:#ddd;margin:0 0 12px">Chào ${escapeHtml(name)},</p>
    <p style="font-size:15px;line-height:1.6;color:#ddd;margin:0 0 12px">Tài khoản UR Private Gym của bạn vừa đăng nhập trên một thiết bị mới:</p>
    <div style="background:#000;border:1px solid #2a2a2a;border-radius:12px;padding:14px 16px;font-size:15px;line-height:1.7">
      <div><span style="color:#a0a0a0">Thiết bị:</span> <b>${escapeHtml(label)}</b></div>
      <div><span style="color:#a0a0a0">Thời gian:</span> <b>${formatDateTime(at)}</b></div>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#ddd;margin:16px 0 0">Nếu đó là bạn, không cần làm gì thêm. Nếu <b>không phải bạn</b>, hãy đăng xuất thiết bị đó ngay:</p>
    ${btn(devicesUrl, 'Quản lý thiết bị')}`)
  const text = `Tài khoản UR Private Gym vừa đăng nhập trên thiết bị mới: ${label} lúc ${formatDateTime(at)}.\nNếu không phải bạn, đăng xuất thiết bị tại: ${devicesUrl}`
  await send(to, 'Cảnh báo: đăng nhập trên thiết bị mới', html, text)
}

/** Email mời khi FM tạo tài khoản PT / PT tạo tài khoản khách. */
export async function sendInviteEmail(to: string, name: string, inviter: string, loginUrl: string) {
  const html = layout('Chào mừng đến UR Private Gym', `
    <p style="font-size:15px;line-height:1.6;color:#ddd;margin:0 0 12px">Chào ${escapeHtml(name)},</p>
    <p style="font-size:15px;line-height:1.6;color:#ddd;margin:0 0 12px">${escapeHtml(inviter)} đã tạo tài khoản cho bạn trên app UR Private Gym để theo dõi lộ trình tập luyện, thực đơn và chỉ số cơ thể.</p>
    <p style="font-size:15px;line-height:1.6;color:#ddd;margin:0">Mở app và nhập email <b>${escapeHtml(to)}</b> — chúng tôi sẽ gửi mã đăng nhập cho bạn, không cần mật khẩu.</p>
    ${btn(loginUrl, 'Mở app')}`)
  const text = `${inviter} đã tạo tài khoản UR Private Gym cho bạn. Mở ${loginUrl} và nhập email ${to} để nhận mã đăng nhập.`
  await send(to, 'Tài khoản UR Private Gym của bạn đã sẵn sàng', html, text)
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
