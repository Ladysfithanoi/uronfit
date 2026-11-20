-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 010: mã đăng nhập 6 số do app tự sinh
-- Không phụ thuộc cài đặt "Email OTP Length" của Supabase (project đang để 8 số,
-- trong khi app và email hiển thị 6 số). Chỉ lưu mã + token link đã băm.
-- Chỉ server (service role) đọc/ghi.
-- ════════════════════════════════════════════════════════════════════════════
create table login_codes (
  email       text primary key,
  code_hash   text not null,
  link_hash   text not null unique,
  attempts    int  not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table login_codes enable row level security;
revoke all on table login_codes from anon, authenticated;
grant select, insert, update, delete on table login_codes to service_role;
