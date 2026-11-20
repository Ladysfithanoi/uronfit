# UR Private Gym — App quản lý khách hàng

Web app (PWA, dùng tốt trên điện thoại) để **FM, PT và khách hàng** cùng theo dõi lộ trình tập luyện, dinh dưỡng và chỉ số cơ thể.

- **Công nghệ:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, Supabase (Postgres, Auth, Storage, Row Level Security), Recharts, triển khai trên Vercel.
- **Đăng nhập:** chỉ bằng email, **không mật khẩu**. App gửi một email có **mã 6 số** và **nút Đăng nhập**. Máy nào chưa từng đăng nhập thì luôn phải xác nhận qua email; chủ tài khoản nhận email cảnh báo khi có máy mới và có thể đăng xuất máy đó từ xa.

## Tiến độ build

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 1 | Nền tảng: giao diện thương hiệu, đăng nhập, 3 vai trò, bảng dữ liệu, phân quyền RLS, dữ liệu mẫu, quản lý thiết bị | ✅ |
| 2 | Khách hàng và lộ trình: danh sách + lọc, hồ sơ, gói tập, tạo tài khoản PT / khách / phụ huynh, lộ trình dạng dòng thời gian, ghi chú "chỉ HLV thấy" | ✅ |
| 3 | Chỉ số: nhập số đo theo nhóm mục tiêu, chỉ số tuỳ chỉnh, biểu đồ có vạch giai đoạn, trung bình tuần, so sánh đầu/cuối giai đoạn, lịch sử đo, ảnh tiến độ, so sánh 2 mốc, ghép ảnh Trước/Sau | ✅ |
| 4 | Thư viện 60 bài (ảnh + YouTube), giáo án theo tuần/buổi, cảnh báo chống chỉ định, hoàn thành buổi + tạ thực tế, tiến độ, mẫu giáo án | ✅ |
| 5 | Meal plan theo ngày/bữa, mẫu thực đơn, nút Chia sẻ, cổng khách hàng, in / xuất PDF | ✅ |
| 6 | Nhóm 1:2 và trẻ em, chỉnh riêng từng người, điểm danh, tự trừ buổi trong gói, dashboard PT/FM, PWA | ✅ (còn: đưa lên Vercel) |

## Kiểm tra 7 kịch bản nghiệm thu (brief mục 8)

| # | Kịch bản | Làm thế nào |
|---|---|---|
| 1 | FM tạo tài khoản PT, tạo khách và gán cho PT đó | Đăng nhập email FM (`tieuanhfitness@gmail.com`) → **Nhân sự → Thêm PT**; **Khách hàng → Thêm khách**, chọn PT phụ trách |
| 2 | PT tạo lộ trình 3 giai đoạn cho khách giảm mỡ, giáo án 4 tuần và meal plan giai đoạn 1 | `+pt1` → mở khách → tab **Lộ trình** (+ Giai đoạn ×3) → tab **Giáo án** (4 tuần × 3 buổi, hoặc từ mẫu "Mẫu giảm mỡ 3 buổi/tuần") → tab **Thực đơn** |
| 3 | 3 lần đo ở 2 giai đoạn: biểu đồ, vạch giai đoạn, bảng đầu/cuối | Tab **Chỉ số** của khách. Dữ liệu mẫu: Thu Hà đã có 4 lần đo qua 2 giai đoạn |
| 4 | PT thêm bài mới kèm ảnh + link video rồi dùng trong giáo án | **Thư viện → Thêm bài** (tải ảnh, dán link YouTube) → mở giáo án → **Thêm bài** |
| 5 | Khách xem giáo án, thực đơn, tiến độ, biểu đồ; không mở được dữ liệu người khác kể cả đổi đường dẫn | `+ha` → các tab dưới đáy. Thử dán link hồ sơ khách khác → bị đưa về trang của mình |
| 6 | Nhóm trẻ em 3 bé, giáo án chung, điểm danh từng bé; phụ huynh chỉ thấy bé mình | `+pt2` → **Nhóm → Nhóm trẻ em thứ 7** → giáo án → **Điểm danh**. `+phuhuynh1` chỉ thấy bé Gia Na, Gia Bin |
| 7 | Thêm bài chống chỉ định cột sống vào giáo án khách thoát vị → cảnh báo | `+pt2` → khách **Phạm Thị Hồng** → tạo giáo án → **Thêm bài** → chọn "Deadlift tạ đòn" → hiện cảnh báo |

---

## 1. Cài đặt trên máy

Cần **Node.js 20 trở lên**.

```bash
npm install
cp .env.local.example .env.local   # rồi điền các giá trị (mục 2)
npm run db:migrate                 # tạo bảng + phân quyền + kho ảnh
npm run db:seed                    # nạp dữ liệu mẫu
npm run dev                        # mở http://localhost:3000
```

Chạy lại dữ liệu mẫu từ đầu (**xoá sạch** dữ liệu cũ và tài khoản demo):

```bash
npm run db:seed -- --reset
```

Nhập thư viện bài tập từ app **training-plan** (~190 bài, 124 bài có video YouTube). Lệnh này chỉ đọc từ training-plan, chạy lại nhiều lần cũng không bị trùng. Sau `--reset` thì chạy lại lệnh này:

```bash
npm run import:exercises                         # đọc D:/Apps/training-plan/.env.local
npm run import:exercises -- đường/dẫn/.env.local # nếu training-plan nằm chỗ khác
```

Script tự gắn nhãn chống chỉ định **cột sống** cho bài dồn tải lên cột sống (deadlift, back squat, good morning, chèo tạ đòn, gập bụng…) và đoán nhóm cơ theo tên bài. FM/PT nên rà lại trong Thư viện.

## 2. Biến môi trường (`.env.local`)

| Biến | Lấy ở đâu | Bắt buộc |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Có |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` key | Có |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key. **Tuyệt đối không chia sẻ.** | Có |
| `DATABASE_URL` | Supabase → nút **Connect** → **Session pooler**. Thay `[YOUR-PASSWORD]` bằng mật khẩu database; ký tự đặc biệt phải mã hoá (`@` → `%40`). Chỉ dùng trên máy để chạy migration / dữ liệu mẫu. | Chỉ trên máy |
| `GMAIL_USER` | Địa chỉ Gmail dùng để gửi email đăng nhập | Có |
| `GMAIL_APP_PASSWORD` | Mật khẩu ứng dụng 16 ký tự (xem mục 3) | Có |
| `APP_URL` | Địa chỉ app sau khi triển khai, vd `https://urgym.vercel.app` | Khi triển khai |
| `FM_EMAIL` | Email thật của FM, dùng khi nạp dữ liệu mẫu (mặc định = `GMAIL_USER`) | Không |
| `SEED_EMAIL` | Hộp thư nhận mã của các tài khoản demo (mặc định = `GMAIL_USER`) | Không |

> Chạy trên máy mà chưa cấu hình Gmail: mã đăng nhập được in ra cửa sổ terminal đang chạy `npm run dev` để vẫn đăng nhập thử được. Khi chạy thật (production) bắt buộc phải có Gmail.

## 3. Tạo mật khẩu ứng dụng Gmail

1. Bật **Xác minh 2 bước**: <https://myaccount.google.com/signinoptions/twosv>
2. Vào <https://myaccount.google.com/apppasswords>, đặt tên `UR Private Gym` và bấm **Tạo**.
3. Chép 16 ký tự vào `GMAIL_APP_PASSWORD` (có hay không có dấu cách đều được).

Nếu trang báo *"Cài đặt bạn đang tìm không khả dụng"*: chưa bật xong Xác minh 2 bước, hoặc đây là tài khoản công ty/trường học bị quản trị viên tắt tính năng này. Khi đó hãy dùng một Gmail cá nhân. Gmail gửi được khoảng 500 email/ngày, đủ cho quy mô phòng tập.

## 4. Tài khoản demo

Dữ liệu mẫu tạo các tài khoản dùng **"Gmail +"**: mọi email `ten+xxx@gmail.com` đều về chung hộp thư `ten@gmail.com`, nên một hộp thư đăng nhập thử được mọi vai trò.

| Vai trò | Email | Ghi chú |
|---|---|---|
| FM | `FM_EMAIL`, hoặc chính `<gmail>@gmail.com` | Quản lý phòng tập |
| PT | `<gmail>+pt1@…` | HLV Ngọc Lan: Thu Hà (giảm mỡ, lộ trình 3 giai đoạn), nhóm 1:2 Mai Anh – Ngọc Trâm |
| PT | `<gmail>+pt2@…` | HLV Minh Khoa: Thị Hồng (thoát vị L4–L5), Quang Huy (chỉnh dáng, khách nam), nhóm trẻ em 3 bé |
| Khách | `+ha`, `+maianh`, `+tram`, `+hong`, `+huy` | Mỗi khách chỉ thấy hồ sơ của mình |
| Phụ huynh | `+phuhuynh1` | Thấy bé Gia Na và bé Gia Bin |
| Phụ huynh | `+phuhuynh2` | Thấy bé Bảo Su |

## Gợi ý calo & macro (thay đổi so với brief, đã duyệt 20/11/2026)

Brief 4.4 ghi app không tự tính calo. Nay bổ sung **công cụ gợi ý cho PT**, dùng cùng công thức với app diet-plan:

- **BMR**: Mifflin St Jeor / Harris Benedict / cân nặng × 22.
- **TDEE** = BMR × (hệ số vận động hằng ngày + hệ số tập gym).
- **Mục tiêu**: giảm (0,5 / 1 / 1,5% cân nặng mỗi tuần, quy đổi 7.700 kcal ≈ 1 kg), duy trì, hoặc tăng (0,5%/tuần).
- **Macro**: đạm = (chiều cao − 100) × 0,9 × 2 g; béo 40–50 g; phần còn lại là tinh bột.

Cách dùng: PT bấm **"Tính gợi ý calo & macro"** trong form thực đơn, xem kết quả, bấm **"Dùng số này"** rồi vẫn sửa tay được. App không tự áp số cho khách. **Công cụ bị khoá với khách trẻ em và khách phục hồi chức năng.** Hồ sơ khách cần có chiều cao, ngày sinh và ít nhất một lần cân.

## 5. Phân quyền

Phân quyền được ép **trong cơ sở dữ liệu** (Row Level Security, `supabase/migrations/002_rls.sql`), không chỉ ẩn trên giao diện:

- FM thấy tất cả; PT chỉ thấy khách mình phụ trách (trực tiếp hoặc qua nhóm của mình); khách chỉ thấy hồ sơ của mình; phụ huynh thấy các bé gắn với mình.
- Khách tập nhóm 1:2 không thấy dữ liệu, kể cả tên, của người tập cùng.
- Ghi chú có cờ **"chỉ HLV thấy"** (mặc định bật) không bao giờ trả về cho khách.
- Khách chỉ thấy giáo án và thực đơn sau khi PT bấm **Chia sẻ**.
- Ảnh tiến độ và ảnh tư thế nằm trong kho riêng tư `client-media`, chỉ mở bằng đường dẫn có thời hạn.
- Không ai tự đổi được vai trò của mình. Tài khoản chỉ được tạo qua server, sau khi đã kiểm tra quyền.

Kiểm thử phân quyền (đăng nhập thật bằng từng vai trò rồi thử đọc/ghi chéo):

```bash
npm run test:rls
```

Kết quả hiện tại: **26/26 ca đạt**. Trên Windows hãy chạy lệnh trong PowerShell hoặc terminal của VS Code (ổ đĩa viết hoa `D:`); chạy từ Git Bash với đường dẫn `d:/` viết thường thì vitest báo lỗi *"failed to find the runner"*.

> Project Supabase mới không tự cấp quyền bảng cho API. Migration `005_grants.sql` cấp quyền cho người đã đăng nhập (RLS vẫn lọc từng dòng) và **không cấp gì cho người chưa đăng nhập**.

## 6. Triển khai lên Vercel

1. Đưa mã nguồn lên GitHub (file `.env.local` đã bị loại khỏi git).
2. Trên <https://vercel.com>: **Add New → Project**, chọn repo, framework tự nhận là Next.js.
3. Ở **Environment Variables**, thêm: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `APP_URL`. **Không** cần `DATABASE_URL`.
4. Bấm **Deploy**. Có địa chỉ rồi thì cập nhật `APP_URL` cho đúng và deploy lại.
5. Supabase → **Authentication → URL Configuration**: đặt **Site URL** bằng địa chỉ Vercel.
6. Không cần chỉnh cài đặt mã OTP trong Supabase: **app tự sinh mã đăng nhập 6 số** (hiệu lực 15 phút, sai quá 5 lần thì huỷ) và chỉ dùng Supabase để tạo phiên đăng nhập.

## 7. Cấu trúc thư mục

```
src/
  app/
    login/              Màn đăng nhập (email → mã 6 số)
    auth/confirm/       Xử lý nút "Đăng nhập" trong email
    (app)/              Khu vực đã đăng nhập (thanh trên, điều hướng dưới đáy / bên trái)
      fm/  pt/  me/     Trang theo vai trò: FM / PT / khách và phụ huynh
      tai-khoan/        Tài khoản, đăng xuất
      thiet-bi/         Thiết bị đang đăng nhập, đăng xuất từ xa
    api/auth/           Gửi mã, xác nhận mã, đăng xuất
    api/devices/        Đăng xuất thiết bị từ xa
  components/           Giao diện dùng chung (ui/ = shadcn)
  lib/                  supabase/, auth, email, devices, date (giờ VN), labels (nhãn tiếng Việt)
  proxy.ts              Làm mới phiên, chặn thiết bị đã đăng xuất, điều hướng theo vai trò
supabase/migrations/    001 bảng · 002 RLS · 003 kho ảnh · 004 cổng thiết bị · 005 quyền API · 006 sửa policy đọc dòng mới · 007 gói tập tự trừ, nhân bản mẫu
scripts/                migrate.mjs, seed.mjs (+ seed-data.mjs: 60 bài tập, chỉ số mặc định)
tests/rls.test.ts       Kiểm thử phân quyền
public/brand/           Logo xuất từ logo.pdf (SVG + PNG nền trong suốt)
```
