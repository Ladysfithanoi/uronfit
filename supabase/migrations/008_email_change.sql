-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 008: đổi email đăng nhập (FM)
-- Mã 6 số gửi tới EMAIL MỚI để chứng minh quyền sở hữu hộp thư. Chỉ lưu mã đã băm.
-- Chỉ server (service role) đọc/ghi: bật RLS, không có policy, không cấp quyền cho người dùng.
-- ════════════════════════════════════════════════════════════════════════════
create table email_change_requests (
  user_id     uuid primary key references profiles (id) on delete cascade,
  new_email   text not null,
  code_hash   text not null,
  attempts    int  not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table email_change_requests enable row level security;
revoke all on table email_change_requests from anon, authenticated;
grant select, insert, update, delete on table email_change_requests to service_role;
