-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 009: sửa trigger chặn đổi cột nhạy cảm của profiles
--
-- Lỗi: xoá một PT thì Postgres tự đặt profiles.created_by = NULL cho các tài khoản
-- khách mà PT đó đã tạo (ON DELETE SET NULL). Trigger cũ coi đó là "người dùng tự đổi
-- created_by" và chặn → Supabase báo "Database error deleting user".
--
-- Sửa: chỉ chặn khi có NGƯỜI DÙNG ĐĂNG NHẬP đang tự sửa (auth.uid() có giá trị và không
-- phải service role). Tác vụ hệ thống (dọn khoá ngoài khi xoá tài khoản) không có
-- auth.uid() nên được phép. Người dùng vẫn không tự đổi được vai trò / email / trạng thái.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function guard_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' and (
     new.role is distinct from old.role or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email or new.created_by is distinct from old.created_by) then
    raise exception 'Không được đổi vai trò, email hoặc trạng thái tài khoản';
  end if;
  return new;
end $$;
