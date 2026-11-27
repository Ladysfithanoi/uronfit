@AGENTS.md

# UR Private Gym — app quản lý khách hàng

Brief gốc: `Brief Claude Code — App quản lý khách hàng UR Private Gym.pdf` (đọc trước khi làm bước mới).
Đã build xong cả 6 bước (người dùng chọn làm liền một mạch rồi kiểm tra một lượt, 20/11/2026); còn lại: triển khai Vercel. Không thêm tính năng ngoài brief khi chưa đề xuất. Nhật ký ăn uống (ý từ app Chisu) để sau Bước 6.

⚠️ Từ 20/11/2026 database Supabase (mlfkcldgebbtehkyrtzm) là DỮ LIỆU THẬT, dùng chung cho máy và Vercel: KHÔNG chạy db:seed --reset hay npm run test:rls (cần dữ liệu mẫu) trên project này — dùng một project Supabase thử nghiệm riêng. Kiểm thử thủ công thì tạo dữ liệu tạm có tên/email `urgym-selftest` và tự dọn.

Quyết định đã đổi so với brief (người dùng duyệt 20/11/2026):
- Đăng nhập chỉ bằng email, không mật khẩu: mã 6 số + link trong cùng một email
  (server sinh bằng Supabase Admin `generateLink`, tự gửi qua Gmail — không dùng SMTP của Supabase).
- Mỗi máy mới phải xác nhận qua email; có màn "Thiết bị đang đăng nhập" (đăng xuất từ xa) và email cảnh báo máy mới.
- Có công cụ GỢI Ý calo/macro cho PT (`src/lib/nutrition.ts`, cùng công thức app diet-plan); không tự áp số; khoá với khách trẻ em & phục hồi chức năng. Chiều cao nhập cho mọi khách.
- Giữ KHÔNG mật khẩu (người dùng chốt lại 20/11). Mục Tài khoản: mọi vai trò tự sửa họ tên + SĐT; chỉ FM đổi email (mã 6 số gửi tới email mới, báo email cũ; bảng `email_change_requests` chỉ service role).
- Tạo lịch tập & thực đơn bằng AI (Gemini, env GEMINI_API_KEYS) — `src/lib/ai/`: workout.ts (theo training-plan; loại bài chống chỉ định TRƯỚC khi gửi AI; dự phòng theo quy tắc), meal-engine.ts + foods-data.ts (chép nguyên bộ giải diet-plan; khoá trẻ em & phục hồi). Nút ở cuối form Thêm khách và tab Giáo án/Thực đơn; kết quả không tự chia sẻ.
- Gói dịch vụ (migration 011, `src/lib/features.ts`): FM bật/tắt tính năng phía khách theo gói; chặn ở RLS qua `portal_allows(cid, feat)` / `client_has_feature`; trang `/fm/goi-dich-vu`; chỉ FM đổi tier_id (trigger). Tính năng mới phía khách phải có mã trong FEATURES + kiểm tra ở cả RLS lẫn trang `/me`.
- Tập 1:2: form khách có bảng phụ người thứ 2 (PartnerPanel, saveClientPair — lỗi thì hoàn tác); bảng theo dõi song song ở nhom/[id] (PairBoard) CHỈ dành cho HLV, hai khách không được thấy dữ liệu của nhau.
- Superset (migration 012, `src/lib/superset.ts`): bài liền nhau cùng `superset_group` (A–Z) tập luân phiên, tối đa 4 bài; nhãn A, B1, B2 tính khi hiển thị; PT ghép/tách trong giáo án; AI có lựa chọn superset (khoá với phục hồi & trẻ em).
- Thư viện bài tập nhập thêm từ app training-plan bằng `npm run import:exercises` (chỉ đọc nguồn, idempotent).

Quy ước:
- Phân quyền thật nằm ở RLS (`supabase/migrations/002_rls.sql`); proxy.ts chỉ điều hướng. Mọi bảng mới phải bật RLS + thêm ca kiểm thử vào `tests/rls.test.ts`.
- Dữ liệu sức khoẻ/trẻ em: không log, không đặt vào URL; ảnh ở bucket riêng tư `client-media/{client_id}/…`, chỉ mở bằng signed URL.
- Giao diện tiếng Việt, xưng hô trung tính; ngày dd/mm/yyyy giờ VN (`src/lib/date.ts`); nút ≥ 44px; hồng #FD3786 chỉ làm điểm nhấn, nút hồng dùng chữ đen.
- Migration mới: thêm file `supabase/migrations/00N_*.sql`, chạy `npm run db:migrate`.
- Danh sách có thể dài ra (khách, bài tập, ghi chú, lịch sử đo, ảnh, mẫu, nhóm…) PHẢI phân trang bằng `src/components/ui/pagination.tsx` (`usePaged` + `Pager`, hoặc `PagedList` cho list render ở server). Bản in giữ đủ dữ liệu.
- Hộp xác nhận / nhập liệu dùng `confirmDialog` / `promptDialog` (`src/components/ui/app-dialog.tsx`), không dùng confirm()/prompt() của trình duyệt.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
