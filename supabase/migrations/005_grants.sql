-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 005: quyền truy cập bảng cho API
--
-- Project Supabase mới KHÔNG tự cấp quyền bảng cho các vai trò API nữa.
--   authenticated  (người đã đăng nhập) → được truy cập, RLS lọc từng dòng
--   service_role   (server của app)    → toàn quyền, dùng sau khi đã kiểm tra quyền
--   anon           (chưa đăng nhập)    → KHÔNG cấp gì: app không có dữ liệu công khai
-- ════════════════════════════════════════════════════════════════════════════

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Bảng chỉ server dùng: người dùng không cần quyền gì
revoke all on table login_requests, _migrations from authenticated;

-- Hàm dùng trong policy chạy với quyền người gọi → cần EXECUTE
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function revoke_auth_session(uuid) from authenticated;
revoke all on all functions in schema public from anon;
revoke all on all tables in schema public from anon;

-- Bảng/hàm tạo ở các migration sau tự có cùng quyền
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from anon, public;
