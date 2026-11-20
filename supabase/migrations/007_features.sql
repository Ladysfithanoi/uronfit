-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 007: phần dữ liệu cho bước 2–6
-- ════════════════════════════════════════════════════════════════════════════

-- Chỉ số tuỳ chọn (% mỡ, khối cơ — mặc định tắt) mà PT bật riêng cho khách
alter table clients add column enabled_metrics uuid[] not null default '{}';
-- Khách đồng ý cho dùng ảnh trước/sau (ghép ảnh transform để tải xuống)
alter table clients add column photo_consent boolean not null default false;

-- ─── Gói tập: tự trừ buổi ───────────────────────────────────────────────────
-- Đã chốt: buổi hoàn thành hoặc điểm danh có mặt tự trừ một buổi.
--   • Giáo án cá nhân (gắn giai đoạn): đánh dấu hoàn thành buổi (không phải buổi tự tập) → trừ 1
--   • Giáo án nhóm: KHÔNG trừ khi hoàn thành; mỗi khách điểm danh "có mặt" → trừ 1 cho khách đó
create or replace function package_adjust(cid uuid, delta int) returns void
language sql security definer set search_path = public as $$
  update client_packages set used_sessions = greatest(0, used_sessions + delta)
   where id = (select id from client_packages where client_id = cid and is_active
               order by start_date desc, created_at desc limit 1)
$$;
revoke all on function package_adjust(uuid, int) from public, anon, authenticated;

create or replace function trg_session_package() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if new.is_self_training then return new; end if;
  select ph.client_id into cid
    from workout_plans p join phases ph on ph.id = p.phase_id
   where p.id = new.plan_id;
  if cid is null then return new; end if;            -- giáo án nhóm / mẫu: không trừ ở đây
  if old.completed_at is null and new.completed_at is not null then
    perform package_adjust(cid, 1);
  elsif old.completed_at is not null and new.completed_at is null then
    perform package_adjust(cid, -1);
  end if;
  return new;
end $$;
create trigger workout_sessions_package after update of completed_at on workout_sessions
  for each row execute function trg_session_package();

create or replace function trg_attendance_package() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.present then perform package_adjust(new.client_id, 1); end if;
  elsif tg_op = 'UPDATE' then
    if new.present and not old.present then perform package_adjust(new.client_id, 1);
    elsif old.present and not new.present then perform package_adjust(new.client_id, -1); end if;
  elsif tg_op = 'DELETE' then
    if old.present then perform package_adjust(old.client_id, -1); end if;
    return old;
  end if;
  return new;
end $$;
create trigger attendance_package after insert or update or delete on attendance
  for each row execute function trg_attendance_package();

-- ─── Nhân bản giáo án / thực đơn (mẫu ↔ giáo án thật) ───────────────────────
-- SECURITY INVOKER: chạy với quyền người gọi, RLS vẫn áp dụng cho mọi dòng ghi.
create or replace function clone_workout_plan(
  src uuid, new_name text, to_phase uuid default null, to_group uuid default null, as_template boolean default false
) returns uuid language plpgsql security invoker set search_path = public as $$
declare pid uuid; s record; new_sid uuid;
begin
  insert into workout_plans (name, phase_id, group_id, is_template, created_by)
  values (new_name, to_phase, to_group, as_template, auth.uid()) returning id into pid;

  for s in select * from workout_sessions where plan_id = src order by week, day_order loop
    insert into workout_sessions (plan_id, week, day_order, title, is_self_training)
    values (pid, s.week, s.day_order, s.title, s.is_self_training) returning id into new_sid;
    -- chỉ chép dòng chung của buổi, bỏ dòng chỉnh riêng cho từng khách
    insert into session_exercises (session_id, exercise_id, sort_order, sets, reps, duration_sec, weight_kg, rest_sec, notes)
    select new_sid, exercise_id, sort_order, sets, reps, duration_sec, weight_kg, rest_sec, notes
      from session_exercises where session_id = s.id and client_id is null;
  end loop;
  return pid;
end $$;

create or replace function clone_meal_plan(
  src uuid, new_name text, to_phase uuid default null, as_template boolean default false
) returns uuid language plpgsql security invoker set search_path = public as $$
declare mid uuid;
begin
  insert into meal_plans (name, phase_id, is_template, kcal, protein_g, carb_g, fat_g, created_by)
  select new_name, to_phase, as_template, kcal, protein_g, carb_g, fat_g, auth.uid()
    from meal_plans where id = src
  returning id into mid;
  if mid is null then raise exception 'Không tìm thấy thực đơn nguồn'; end if;
  insert into meals (meal_plan_id, day_number, meal_slot, dish, portion, kcal, notes, sort_order)
  select mid, day_number, meal_slot, dish, portion, kcal, notes, sort_order from meals where meal_plan_id = src;
  return mid;
end $$;

grant execute on function clone_workout_plan(uuid, text, uuid, uuid, boolean) to authenticated;
grant execute on function clone_meal_plan(uuid, text, uuid, boolean) to authenticated;
revoke execute on function clone_workout_plan(uuid, text, uuid, uuid, boolean) from anon, public;
revoke execute on function clone_meal_plan(uuid, text, uuid, boolean) from anon, public;
revoke execute on function package_adjust(uuid, int) from anon, public;
