-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 006: policy SELECT đọc được dòng VỪA TẠO
--
-- Lỗi: INSERT ... RETURNING (supabase .insert().select()) kiểm tra policy SELECT
-- trên dòng mới. Các hàm STABLE như can_manage_client(id) tự truy vấn lại bảng
-- bằng snapshot đầu câu lệnh nên KHÔNG thấy dòng vừa thêm → báo vi phạm RLS.
-- Sửa: policy SELECT xét trực tiếp cột của dòng (pt_id, phase_id, ...) thay vì
-- tra lại chính bảng đó theo id.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function phase_client(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from phases where id = pid
$$;
grant execute on function phase_client(uuid) to authenticated, service_role;

-- clients
drop policy clients_select on clients;
create policy clients_select on clients for select using (
  is_fm()
  or (app_role() = 'pt' and pt_id = auth.uid())
  or can_view_client(id)
);

-- groups
drop policy groups_select on groups;
create policy groups_select on groups for select using (
  is_fm()
  or (app_role() = 'pt' and pt_id = auth.uid())
  or is_group_viewer(id)
);

-- workout_plans: khách chỉ thấy khi đã Chia sẻ
drop policy plans_select on workout_plans;
create policy plans_select on workout_plans for select using (
  (is_template and is_staff())
  or (phase_id is not null and (
        can_manage_client(phase_client(phase_id))
        or (shared_at is not null and can_view_client(phase_client(phase_id)))))
  or (group_id is not null and (
        can_manage_group(group_id)
        or (shared_at is not null and is_group_viewer(group_id))))
);

-- meal_plans
drop policy meal_plans_select on meal_plans;
create policy meal_plans_select on meal_plans for select using (
  (is_template and is_staff())
  or (phase_id is not null and (
        can_manage_client(phase_client(phase_id))
        or (shared_at is not null and can_view_client(phase_client(phase_id)))))
);
