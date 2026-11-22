-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 011: gói dịch vụ quyết định tính năng khách được dùng
--
-- FM tạo các gói (vd Cơ bản / Tiêu chuẩn / VIP) và bật/tắt từng tính năng phía khách.
-- Mỗi khách gắn một gói (không gắn → gói mặc định). Tính năng tắt bị CHẶN Ở DATABASE:
-- khách / phụ huynh không đọc/ghi được dữ liệu của tính năng đó dù gọi thẳng API.
-- HLV (FM, PT) không bị ảnh hưởng.
--
-- Mã tính năng:
--   workout_view       xem giáo án             workout_media    xem ảnh / video bài tập
--   self_training      tự tick buổi tự tập     meal_view        xem thực đơn
--   metrics_view       xem biểu đồ & lịch sử   metrics_entry    tự nhập cân nặng, số đo
--   photos_view        xem ảnh tiến độ         coach_notes      xem lời nhắn của HLV
--   print_pdf          in / xuất PDF
-- ════════════════════════════════════════════════════════════════════════════

create table service_tiers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  features    text[] not null default '{}',
  is_default  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
-- Chỉ một gói mặc định
create unique index service_tiers_one_default on service_tiers (is_default) where is_default;

alter table clients add column tier_id uuid references service_tiers (id) on delete set null;

alter table service_tiers enable row level security;
-- Ai đăng nhập cũng xem được danh sách gói (khách thấy tên gói của mình); chỉ FM sửa
create policy tiers_select on service_tiers for select using (auth.uid() is not null);
create policy tiers_write  on service_tiers for all using (is_fm()) with check (is_fm());
grant select, insert, update, delete on service_tiers to authenticated, service_role;

-- Gói gợi ý ban đầu — mặc định là gói đầy đủ để khách hiện có không mất tính năng nào
insert into service_tiers (name, description, features, is_default, sort_order) values
  ('Cơ bản', 'Xem giáo án và thực đơn HLV gửi',
     '{workout_view,meal_view,coach_notes}', false, 1),
  ('Tiêu chuẩn', 'Thêm video hướng dẫn, theo dõi chỉ số và tự nhập số đo',
     '{workout_view,workout_media,self_training,meal_view,metrics_view,metrics_entry,coach_notes}', false, 2),
  ('VIP', 'Đầy đủ mọi tính năng',
     '{workout_view,workout_media,self_training,meal_view,metrics_view,metrics_entry,photos_view,coach_notes,print_pdf}', true, 3);

-- ─── Hàm kiểm tra ─────────────────────────────────────────────────────────────
-- Tính năng của khách theo gói. Không gắn gói → gói mặc định. Chưa có gói nào → mọi tính năng.
create or replace function client_has_feature(cid uuid, feat text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select feat = any (t.features)
       from clients c
       join service_tiers t on t.id = coalesce(c.tier_id, (select id from service_tiers where is_default limit 1))
      where c.id = cid),
    not exists (select 1 from service_tiers)
  )
$$;

-- HLV quản lý khách → luôn được; khách / phụ huynh → phải xem được hồ sơ VÀ gói có tính năng
create or replace function portal_allows(cid uuid, feat text) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_client(cid) or (can_view_client(cid) and client_has_feature(cid, feat))
$$;

grant execute on function client_has_feature(uuid, text) to authenticated, service_role;
grant execute on function portal_allows(uuid, text) to authenticated, service_role;
revoke execute on function client_has_feature(uuid, text) from anon, public;
revoke execute on function portal_allows(uuid, text) from anon, public;

-- Chỉ FM đổi gói của khách (PT vẫn sửa được các thông tin khác)
create or replace function guard_client_tier() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tier_id is distinct from old.tier_id and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role' and not is_fm() then
    raise exception 'Chỉ quản lý phòng tập được đổi gói dịch vụ của khách';
  end if;
  return new;
end $$;
create trigger clients_tier_guard before update of tier_id on clients
  for each row execute function guard_client_tier();

create or replace function guard_client_tier_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tier_id is not null and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role' and not is_fm() then
    new.tier_id := null; -- PT tạo khách → gói mặc định
  end if;
  return new;
end $$;
create trigger clients_tier_guard_insert before insert on clients
  for each row execute function guard_client_tier_insert();

-- ─── Giáo án ──────────────────────────────────────────────────────────────────
create or replace function can_view_plan(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_plan(pid) or exists (
    select 1 from workout_plans p
    left join phases ph on ph.id = p.phase_id
    where p.id = pid and (
      (p.is_template and is_staff())
      or (p.shared_at is not null and p.phase_id is not null and portal_allows(ph.client_id, 'workout_view'))
      or (p.shared_at is not null and p.group_id is not null and exists (
            select 1 from group_members gm join client_access a on a.client_id = gm.client_id
             where gm.group_id = p.group_id and a.profile_id = auth.uid()
               and client_has_feature(gm.client_id, 'workout_view')))
    ))
$$;

drop policy plans_select on workout_plans;
create policy plans_select on workout_plans for select using (
  (is_template and is_staff())
  or (phase_id is not null and (
        can_manage_client(phase_client(phase_id))
        or (shared_at is not null and portal_allows(phase_client(phase_id), 'workout_view'))))
  or (group_id is not null and (
        can_manage_group(group_id)
        or (shared_at is not null and exists (
              select 1 from group_members gm join client_access a on a.client_id = gm.client_id
               where gm.group_id = workout_plans.group_id and a.profile_id = auth.uid()
                 and client_has_feature(gm.client_id, 'workout_view')))))
);

drop policy attendance_select on attendance;
create policy attendance_select on attendance for select using (portal_allows(client_id, 'workout_view'));

-- Tự tick buổi tự tập cần tính năng self_training
create or replace function complete_self_session(sid uuid, done boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from workout_sessions s
      join workout_plans p on p.id = s.plan_id
      left join phases ph on ph.id = p.phase_id
     where s.id = sid and s.is_self_training and can_view_plan(s.plan_id)
       and (ph.client_id is null or portal_allows(ph.client_id, 'self_training'))
  ) then
    raise exception 'Không có quyền với buổi tập này';
  end if;
  update workout_sessions
     set completed_at = case when done then now() else null end,
         completed_by = case when done then auth.uid() else null end
   where id = sid;
end $$;

-- ─── Thực đơn ─────────────────────────────────────────────────────────────────
create or replace function can_view_meal_plan(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_meal_plan(mid) or exists (
    select 1 from meal_plans m left join phases ph on ph.id = m.phase_id
    where m.id = mid and (
      (m.is_template and is_staff())
      or (m.shared_at is not null and m.phase_id is not null and portal_allows(ph.client_id, 'meal_view'))
    ))
$$;

drop policy meal_plans_select on meal_plans;
create policy meal_plans_select on meal_plans for select using (
  (is_template and is_staff())
  or (phase_id is not null and (
        can_manage_client(phase_client(phase_id))
        or (shared_at is not null and portal_allows(phase_client(phase_id), 'meal_view'))))
);

-- ─── Chỉ số ───────────────────────────────────────────────────────────────────
drop policy measurements_select on measurements;
create policy measurements_select on measurements for select using (portal_allows(client_id, 'metrics_view'));

drop policy measurements_client_insert on measurements;
create policy measurements_client_insert on measurements for insert with check (
  app_role() in ('client', 'guardian') and can_view_client(client_id) and client_has_feature(client_id, 'metrics_entry')
  and source = 'client' and measured_by = auth.uid()
  and exists (select 1 from metric_types t where t.id = metric_type_id and t.client_can_enter)
);
drop policy measurements_client_modify on measurements;
create policy measurements_client_modify on measurements for update
  using (app_role() in ('client', 'guardian') and source = 'client' and measured_by = auth.uid() and client_has_feature(client_id, 'metrics_entry'))
  with check (source = 'client' and measured_by = auth.uid() and can_view_client(client_id));
drop policy measurements_client_delete on measurements;
create policy measurements_client_delete on measurements for delete
  using (app_role() in ('client', 'guardian') and source = 'client' and measured_by = auth.uid() and client_has_feature(client_id, 'metrics_entry'));

-- ─── Ảnh tiến độ ──────────────────────────────────────────────────────────────
drop policy photos_select on progress_photos;
create policy photos_select on progress_photos for select using (portal_allows(client_id, 'photos_view'));

drop policy client_media_select on storage.objects;
create policy client_media_select on storage.objects for select to authenticated using (
  bucket_id = 'client-media' and public.portal_allows(public.storage_client_id(name), 'photos_view')
);

-- ─── Lời nhắn của HLV ─────────────────────────────────────────────────────────
drop policy notes_select on notes;
create policy notes_select on notes for select using (
  can_manage_client(client_id) or (not coach_only and portal_allows(client_id, 'coach_notes'))
);
