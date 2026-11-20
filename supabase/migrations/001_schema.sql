-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 001: bảng dữ liệu
-- Chuỗi chính: Khách (clients) → Giai đoạn (phases) → giáo án / meal plan / số đo
-- Phân quyền (RLS) nằm ở 002_rls.sql, kho ảnh ở 003_storage.sql.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Kiểu liệt kê ───────────────────────────────────────────────────────────
create type user_role        as enum ('fm', 'pt', 'client', 'guardian');
create type gender           as enum ('female', 'male');
create type goal_group       as enum ('fat_loss', 'weight_gain', 'posture', 'rehab', 'kids');
create type training_type    as enum ('one_on_one', 'one_on_two', 'kids_group');
create type client_status    as enum ('active', 'paused', 'ended');
create type phase_status     as enum ('planned', 'active', 'completed');
create type group_type       as enum ('one_on_two', 'kids');
create type access_relation  as enum ('self', 'guardian');
create type entry_source     as enum ('staff', 'client');
create type photo_angle      as enum ('front', 'back', 'left', 'right', 'other');
create type metric_kind      as enum ('number', 'text');

-- ─── Tài khoản đăng nhập ────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        user_role not null,
  email       text not null unique,
  phone       text,
  is_active   boolean not null default true,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
-- Quyết định đã chốt: chỉ có MỘT tài khoản FM.
create unique index profiles_single_fm on profiles (role) where role = 'fm';

-- ─── Khách hàng ─────────────────────────────────────────────────────────────
create table clients (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  gender            gender not null,
  birth_date        date,
  phone             text,
  avatar_path       text,                 -- đường dẫn trong kho riêng tư client-media
  start_date        date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  goals             goal_group[] not null default '{}',
  training_type     training_type not null default 'one_on_one',
  pt_id             uuid references profiles (id) on delete set null,
  status            client_status not null default 'active',
  -- Tiền sử sức khoẻ (dữ liệu nhạy cảm)
  injuries          text,
  surgeries         text,
  joint_conditions  text,
  doctor_orders     text,
  avoid_movements   text,
  -- Nhãn tiền sử dùng để so khớp với chống chỉ định của bài tập (vd 'spine', 'knee')
  health_flags      text[] not null default '{}',
  -- Trẻ em
  is_kid            boolean not null default false,
  guardian_name     text,
  guardian_phone    text,
  height_cm         numeric(5,1),
  kid_notes         text,
  created_by        uuid references profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index clients_pt_idx on clients (pt_id);

-- Tài khoản nào được xem hồ sơ khách nào: chính khách (self) hoặc phụ huynh.
-- Một phụ huynh có thể gắn nhiều bé.
create table client_access (
  client_id   uuid not null references clients (id) on delete cascade,
  profile_id  uuid not null references profiles (id) on delete cascade,
  relation    access_relation not null,
  primary key (client_id, profile_id)
);
create index client_access_profile_idx on client_access (profile_id);

-- Gói tập: tổng số buổi; buổi hoàn thành / điểm danh có mặt tự trừ (bước 4–6).
create table client_packages (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients (id) on delete cascade,
  name            text not null default 'Gói tập',
  total_sessions  int  not null check (total_sessions > 0),
  used_sessions   int  not null default 0 check (used_sessions >= 0),
  start_date      date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index client_packages_client_idx on client_packages (client_id);

-- ─── Nhóm 1:2 và nhóm trẻ em ────────────────────────────────────────────────
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        group_type not null,
  pt_id       uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create table group_members (
  group_id   uuid not null references groups (id) on delete cascade,
  client_id  uuid not null references clients (id) on delete cascade,
  primary key (group_id, client_id)
);
create index group_members_client_idx on group_members (client_id);

-- ─── Lộ trình = chuỗi giai đoạn của một khách ───────────────────────────────
create table phases (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients (id) on delete cascade,
  name        text not null,
  goal        text,
  start_date  date not null,
  end_date    date,
  targets     text,                       -- chỉ tiêu, vd "giảm 3 kg; đau lưng ≤ 2/10"
  sort_order  int  not null default 0,
  status      phase_status not null default 'planned',
  created_at  timestamptz not null default now()
);
create index phases_client_idx on phases (client_id, sort_order);

-- ─── Thư viện bài tập ───────────────────────────────────────────────────────
create table exercises (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  muscle_group       text,
  equipment          text,
  description        text,
  image_path         text,                -- kho exercise-media
  video_url          text,                -- link YouTube
  tags               text[] not null default '{}',   -- 'rehab' | 'posture' | 'kids'
  contraindications  text[] not null default '{}',   -- cùng bộ nhãn với clients.health_flags
  created_by         uuid references profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ─── Giáo án ────────────────────────────────────────────────────────────────
create table workout_plans (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phase_id     uuid references phases (id) on delete cascade,
  group_id     uuid references groups (id) on delete cascade,
  is_template  boolean not null default false,
  shared_at    timestamptz,               -- nút "Chia sẻ": khách chỉ thấy khi đã chia sẻ
  created_by   uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  -- mẫu: không gắn đâu; giáo án thật: gắn đúng MỘT giai đoạn hoặc MỘT nhóm
  constraint workout_plan_owner check (
    (is_template and phase_id is null and group_id is null) or
    (not is_template and num_nonnulls(phase_id, group_id) = 1)
  )
);
create index workout_plans_phase_idx on workout_plans (phase_id);
create index workout_plans_group_idx on workout_plans (group_id);

create table workout_sessions (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references workout_plans (id) on delete cascade,
  week              int  not null check (week >= 1),
  day_order         int  not null check (day_order >= 1),
  title             text,
  scheduled_date    date,
  is_self_training  boolean not null default false,  -- buổi khách tự tập
  completed_at      timestamptz,
  completed_by      uuid references profiles (id) on delete set null,
  comment           text,                            -- nhận xét sau buổi
  created_at        timestamptz not null default now()
);
create index workout_sessions_plan_idx on workout_sessions (plan_id, week, day_order);

create table session_exercises (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references workout_sessions (id) on delete cascade,
  exercise_id       uuid not null references exercises (id) on delete restrict,
  -- null = áp dụng cho cả buổi; có giá trị = dòng chỉnh riêng cho 1 khách trong nhóm
  client_id         uuid references clients (id) on delete cascade,
  replaces_id       uuid references session_exercises (id) on delete cascade,
  sort_order        int  not null default 0,
  sets              int,
  reps              text,                 -- "10" hoặc "8-12"
  duration_sec      int,
  weight_kg         numeric(6,2),
  rest_sec          int,
  notes             text,
  actual_weight_kg  numeric(6,2),
  created_at        timestamptz not null default now()
);
create index session_exercises_session_idx on session_exercises (session_id, sort_order);

create table attendance (
  session_id  uuid not null references workout_sessions (id) on delete cascade,
  client_id   uuid not null references clients (id) on delete cascade,
  present     boolean not null,
  marked_by   uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (session_id, client_id)
);

-- ─── Meal plan ──────────────────────────────────────────────────────────────
create table meal_plans (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phase_id     uuid references phases (id) on delete cascade,
  is_template  boolean not null default false,
  kcal         int,          -- PT tự nhập; app KHÔNG tự tính calo
  protein_g    int,
  carb_g       int,
  fat_g        int,
  shared_at    timestamptz,
  created_by   uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint meal_plan_owner check (
    (is_template and phase_id is null) or (not is_template and phase_id is not null)
  )
);
create index meal_plans_phase_idx on meal_plans (phase_id);

create table meals (
  id            uuid primary key default gen_random_uuid(),
  meal_plan_id  uuid not null references meal_plans (id) on delete cascade,
  day_number    int  not null check (day_number >= 1),
  meal_slot     text not null,            -- 'Sáng', 'Trưa', ...
  dish          text not null,
  portion       text,
  kcal          int,
  notes         text,                     -- ghi chú thay thế
  sort_order    int  not null default 0
);
create index meals_plan_idx on meals (meal_plan_id, day_number, sort_order);

-- ─── Chỉ số cơ thể ──────────────────────────────────────────────────────────
create table metric_types (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  unit                  text,
  kind                  metric_kind not null default 'number',
  goal                  goal_group,       -- nhóm mục tiêu dùng chỉ số này
  client_id             uuid references clients (id) on delete cascade, -- null = mặc định dùng chung
  is_default            boolean not null default false,
  default_enabled       boolean not null default true,  -- % mỡ, khối cơ: false
  client_can_enter      boolean not null default false, -- cân nặng + số đo vòng
  sort_order            int not null default 0,
  created_by            uuid references profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  constraint metric_scope check (not (is_default and client_id is not null))
);

create table measurements (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients (id) on delete cascade,
  phase_id        uuid references phases (id) on delete set null,
  metric_type_id  uuid not null references metric_types (id) on delete cascade,
  measured_on     date not null,
  value_num       numeric(8,2),
  value_text      text,
  measured_by     uuid references profiles (id) on delete set null,
  source          entry_source not null default 'staff',  -- khách hay PT nhập
  created_at      timestamptz not null default now()
);
-- Mỗi chỉ số chỉ một giá trị / khách / ngày: nhập lại cùng ngày = sửa (upsert), không tạo điểm trùng
create unique index measurements_one_per_day on measurements (client_id, metric_type_id, measured_on);

create table progress_photos (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients (id) on delete cascade,
  phase_id      uuid references phases (id) on delete set null,
  taken_on      date not null,
  angle         photo_angle not null default 'front',
  storage_path  text not null,            -- kho riêng tư client-media
  uploaded_by   uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index progress_photos_client_idx on progress_photos (client_id, taken_on);

-- ─── Ghi chú ────────────────────────────────────────────────────────────────
create table notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients (id) on delete cascade,
  content     text not null,
  coach_only  boolean not null default true,   -- "chỉ HLV thấy", mặc định BẬT
  author_id   uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index notes_client_idx on notes (client_id, created_at desc);

-- ─── Thiết bị đăng nhập (đề xuất bổ sung đã duyệt) ──────────────────────────
create table devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  device_key    text not null,            -- giá trị ngẫu nhiên trong cookie httpOnly
  label         text not null,            -- "iPhone · Safari"
  user_agent    text,
  session_id    uuid,                     -- auth.sessions.id, để đăng xuất từ xa
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  revoked_at    timestamptz,
  unique (user_id, device_key)
);

-- Chống gửi email đăng nhập dồn dập (chỉ server dùng, không có policy cho người dùng)
create table login_requests (
  id          bigint generated always as identity primary key,
  email       text not null,
  created_at  timestamptz not null default now()
);
create index login_requests_email_idx on login_requests (email, created_at desc);

-- ─── updated_at ─────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();
