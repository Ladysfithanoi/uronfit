-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 002: Row Level Security theo bảng phân quyền (brief mục 2)
--
-- Nguyên tắc:
--   • Mọi bảng bật RLS. Không có policy = không ai (ngoài service role) truy cập.
--   • Hàm hỗ trợ là SECURITY DEFINER để tránh đệ quy policy, chỉ trả boolean.
--   • Tạo tài khoản / gán quyền xem hồ sơ (client_access) chỉ đi qua API server
--     dùng service role sau khi đã kiểm tra vai trò — người dùng không tự ghi được.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Hàm hỗ trợ ─────────────────────────────────────────────────────────────
create or replace function app_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function is_fm() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'fm', false)
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() in ('fm', 'pt'), false)
$$;

-- FM, hoặc PT phụ trách khách, hoặc PT của nhóm có khách đó
create or replace function can_manage_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_fm() or (
    app_role() = 'pt' and (
      exists (select 1 from clients c where c.id = cid and c.pt_id = auth.uid())
      or exists (select 1 from group_members gm join groups g on g.id = gm.group_id
                 where gm.client_id = cid and g.pt_id = auth.uid())
    )
  )
$$;

-- Người quản lý, hoặc chính khách / phụ huynh của bé
create or replace function can_view_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_client(cid) or (
    app_role() in ('client', 'guardian') and
    exists (select 1 from client_access a where a.client_id = cid and a.profile_id = auth.uid())
  )
$$;

-- Khách/phụ huynh là thành viên của nhóm (qua một bé/khách mình được xem)
create or replace function is_group_viewer(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app_role() in ('client', 'guardian') and exists (
    select 1 from group_members gm join client_access a on a.client_id = gm.client_id
    where gm.group_id = gid and a.profile_id = auth.uid())
$$;

create or replace function can_manage_group(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_fm() or (app_role() = 'pt' and exists (
    select 1 from groups g where g.id = gid and g.pt_id = auth.uid()))
$$;

create or replace function can_manage_plan(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workout_plans p
    left join phases ph on ph.id = p.phase_id
    where p.id = pid and (
      (p.is_template and (is_fm() or (app_role() = 'pt' and p.created_by = auth.uid())))
      or (p.phase_id is not null and can_manage_client(ph.client_id))
      or (p.group_id is not null and can_manage_group(p.group_id))
    ))
$$;

-- Khách chỉ thấy giáo án ĐÃ CHIA SẺ của mình; HLV thấy mẫu và giáo án mình quản lý
create or replace function can_view_plan(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_plan(pid) or exists (
    select 1 from workout_plans p
    left join phases ph on ph.id = p.phase_id
    where p.id = pid and (
      (p.is_template and is_staff())
      or (p.shared_at is not null and p.phase_id is not null and can_view_client(ph.client_id))
      or (p.shared_at is not null and p.group_id is not null and is_group_viewer(p.group_id))
    ))
$$;

create or replace function can_manage_meal_plan(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from meal_plans m left join phases ph on ph.id = m.phase_id
    where m.id = mid and (
      (m.is_template and (is_fm() or (app_role() = 'pt' and m.created_by = auth.uid())))
      or (m.phase_id is not null and can_manage_client(ph.client_id))
    ))
$$;

create or replace function can_view_meal_plan(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_manage_meal_plan(mid) or exists (
    select 1 from meal_plans m left join phases ph on ph.id = m.phase_id
    where m.id = mid and (
      (m.is_template and is_staff())
      or (m.shared_at is not null and m.phase_id is not null and can_view_client(ph.client_id))
    ))
$$;

create or replace function session_plan(sid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select plan_id from workout_sessions where id = sid
$$;

-- Khách xem được bài tập có trong giáo án (đã chia sẻ) của mình
create or replace function exercise_in_my_plans(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_exercises se
    join workout_sessions s on s.id = se.session_id
    where se.exercise_id = eid and can_view_plan(s.plan_id)
      and (se.client_id is null or can_view_client(se.client_id)))
$$;

-- ─── Bật RLS cho MỌI bảng ───────────────────────────────────────────────────
alter table profiles          enable row level security;
alter table clients           enable row level security;
alter table client_access     enable row level security;
alter table client_packages   enable row level security;
alter table groups            enable row level security;
alter table group_members     enable row level security;
alter table phases            enable row level security;
alter table exercises         enable row level security;
alter table workout_plans     enable row level security;
alter table workout_sessions  enable row level security;
alter table session_exercises enable row level security;
alter table attendance        enable row level security;
alter table meal_plans        enable row level security;
alter table meals             enable row level security;
alter table metric_types      enable row level security;
alter table measurements      enable row level security;
alter table progress_photos   enable row level security;
alter table notes             enable row level security;
alter table devices           enable row level security;
alter table login_requests    enable row level security;

-- ─── profiles ───────────────────────────────────────────────────────────────
-- Ai cũng xem được hồ sơ của chính mình; HLV xem được tên FM/PT;
-- PT xem tài khoản khách/phụ huynh gắn với khách mình; FM xem tất cả.
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or is_fm()
  or (is_staff() and role in ('fm', 'pt'))
  or (app_role() = 'pt' and exists (
        select 1 from client_access a where a.profile_id = profiles.id
        and can_manage_client(a.client_id)))
);
-- Sửa tên/SĐT của chính mình; vai trò và trạng thái khoá bằng trigger bên dưới.
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function guard_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service role (API server) được đổi mọi thứ; người dùng thường thì không
  if coalesce(auth.role(), '') <> 'service_role' and (
     new.role is distinct from old.role or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email or new.created_by is distinct from old.created_by) then
    raise exception 'Không được đổi vai trò, email hoặc trạng thái tài khoản';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles
  for each row execute function guard_profile_columns();

-- ─── clients ────────────────────────────────────────────────────────────────
create policy clients_select on clients for select using (can_view_client(id));
create policy clients_insert on clients for insert with check (
  is_fm() or (app_role() = 'pt' and pt_id = auth.uid())
);
-- PT sửa khách của mình nhưng không chuyển khách sang PT khác
create policy clients_update on clients for update using (can_manage_client(id))
  with check (is_fm() or (app_role() = 'pt' and pt_id = auth.uid()));
create policy clients_delete on clients for delete using (is_fm());

-- ─── client_access (chỉ đọc; ghi qua API server) ────────────────────────────
create policy client_access_select on client_access for select using (
  profile_id = auth.uid() or can_manage_client(client_id)
);

-- ─── client_packages ────────────────────────────────────────────────────────
create policy packages_select on client_packages for select using (can_view_client(client_id));
create policy packages_write  on client_packages for all
  using (can_manage_client(client_id)) with check (can_manage_client(client_id));

-- ─── groups / group_members ─────────────────────────────────────────────────
create policy groups_select on groups for select using (
  can_manage_group(id) or is_group_viewer(id)
);
create policy groups_insert on groups for insert with check (
  is_fm() or (app_role() = 'pt' and pt_id = auth.uid())
);
create policy groups_update on groups for update using (can_manage_group(id))
  with check (is_fm() or (app_role() = 'pt' and pt_id = auth.uid()));
create policy groups_delete on groups for delete using (can_manage_group(id));

-- Khách chỉ thấy DÒNG CỦA MÌNH trong nhóm — không biết ai tập cùng
create policy group_members_select on group_members for select using (
  can_manage_group(group_id)
  or (app_role() in ('client', 'guardian') and can_view_client(client_id))
);
create policy group_members_write on group_members for all
  using (can_manage_group(group_id))
  with check (can_manage_group(group_id) and can_manage_client(client_id));

-- ─── phases ─────────────────────────────────────────────────────────────────
create policy phases_select on phases for select using (can_view_client(client_id));
create policy phases_write  on phases for all
  using (can_manage_client(client_id)) with check (can_manage_client(client_id));

-- ─── exercises ──────────────────────────────────────────────────────────────
create policy exercises_select on exercises for select using (
  is_staff() or exercise_in_my_plans(id)
);
create policy exercises_insert on exercises for insert with check (
  is_staff() and created_by = auth.uid()
);
create policy exercises_update on exercises for update
  using (is_fm() or (app_role() = 'pt' and created_by = auth.uid()))
  with check (is_fm() or (app_role() = 'pt' and created_by = auth.uid()));
create policy exercises_delete on exercises for delete using (is_fm());

-- ─── workout_plans / sessions / session_exercises / attendance ──────────────
create policy plans_select on workout_plans for select using (can_view_plan(id));
create policy plans_insert on workout_plans for insert with check (
  created_by = auth.uid() and is_staff() and (
    (is_template)
    or (phase_id is not null and can_manage_client((select client_id from phases where id = phase_id)))
    or (group_id is not null and can_manage_group(group_id))
  )
);
create policy plans_update on workout_plans for update
  using (can_manage_plan(id)) with check (can_manage_plan(id));
create policy plans_delete on workout_plans for delete using (can_manage_plan(id));

create policy sessions_select on workout_sessions for select using (can_view_plan(plan_id));
create policy sessions_write  on workout_sessions for all
  using (can_manage_plan(plan_id)) with check (can_manage_plan(plan_id));
-- Khách tự tick buổi tự tập: đi qua hàm complete_self_session() bên dưới.

create policy session_ex_select on session_exercises for select using (
  can_view_plan(session_plan(session_id))
  and (client_id is null or can_view_client(client_id))
);
create policy session_ex_write on session_exercises for all
  using (can_manage_plan(session_plan(session_id)))
  with check (can_manage_plan(session_plan(session_id)));

create policy attendance_select on attendance for select using (can_view_client(client_id));
create policy attendance_write  on attendance for all
  using (can_manage_plan(session_plan(session_id)))
  with check (can_manage_plan(session_plan(session_id)) and can_manage_client(client_id));

-- ─── meal_plans / meals ─────────────────────────────────────────────────────
create policy meal_plans_select on meal_plans for select using (can_view_meal_plan(id));
create policy meal_plans_insert on meal_plans for insert with check (
  created_by = auth.uid() and is_staff() and (
    is_template
    or (phase_id is not null and can_manage_client((select client_id from phases where id = phase_id)))
  )
);
create policy meal_plans_update on meal_plans for update
  using (can_manage_meal_plan(id)) with check (can_manage_meal_plan(id));
create policy meal_plans_delete on meal_plans for delete using (can_manage_meal_plan(id));

create policy meals_select on meals for select using (can_view_meal_plan(meal_plan_id));
create policy meals_write  on meals for all
  using (can_manage_meal_plan(meal_plan_id)) with check (can_manage_meal_plan(meal_plan_id));

-- ─── metric_types ───────────────────────────────────────────────────────────
create policy metric_types_select on metric_types for select using (
  (client_id is null and auth.uid() is not null) or can_view_client(client_id)
);
create policy metric_types_write on metric_types for all
  using ((client_id is null and is_fm()) or (client_id is not null and can_manage_client(client_id)))
  with check ((client_id is null and is_fm()) or (client_id is not null and can_manage_client(client_id)));

-- ─── measurements ───────────────────────────────────────────────────────────
create policy measurements_select on measurements for select using (can_view_client(client_id));
create policy measurements_staff on measurements for all
  using (can_manage_client(client_id))
  with check (can_manage_client(client_id) and source = 'staff');
-- Khách/phụ huynh tự nhập cân nặng + số đo vòng (chỉ số client_can_enter)
create policy measurements_client_insert on measurements for insert with check (
  app_role() in ('client', 'guardian') and can_view_client(client_id)
  and source = 'client' and measured_by = auth.uid()
  and exists (select 1 from metric_types t where t.id = metric_type_id and t.client_can_enter)
);
create policy measurements_client_modify on measurements for update
  using (app_role() in ('client', 'guardian') and source = 'client' and measured_by = auth.uid())
  with check (source = 'client' and measured_by = auth.uid() and can_view_client(client_id));
create policy measurements_client_delete on measurements for delete
  using (app_role() in ('client', 'guardian') and source = 'client' and measured_by = auth.uid());

-- ─── progress_photos ────────────────────────────────────────────────────────
create policy photos_select on progress_photos for select using (can_view_client(client_id));
create policy photos_write  on progress_photos for all
  using (can_manage_client(client_id)) with check (can_manage_client(client_id));

-- ─── notes: ghi chú "chỉ HLV thấy" bị chặn ngay tại cơ sở dữ liệu ───────────
create policy notes_select on notes for select using (
  can_manage_client(client_id) or (not coach_only and can_view_client(client_id))
);
create policy notes_write on notes for all
  using (can_manage_client(client_id)) with check (can_manage_client(client_id));

-- ─── devices: chỉ chủ tài khoản xem; ghi qua API server ─────────────────────
create policy devices_select on devices for select using (user_id = auth.uid());

-- login_requests: không có policy → chỉ service role.

-- ─── Khách tự đánh dấu hoàn thành buổi TỰ TẬP ───────────────────────────────
create or replace function complete_self_session(sid uuid, done boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from workout_sessions s
    where s.id = sid and s.is_self_training and can_view_plan(s.plan_id)
  ) then
    raise exception 'Không có quyền với buổi tập này';
  end if;
  update workout_sessions
     set completed_at = case when done then now() else null end,
         completed_by = case when done then auth.uid() else null end
   where id = sid;
end $$;

-- ─── Đăng xuất thiết bị từ xa: xoá phiên trong auth.sessions (chỉ service role)
create or replace function revoke_auth_session(sid uuid) returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.sessions where id = sid
$$;
revoke all on function revoke_auth_session(uuid) from public, anon, authenticated;
grant execute on function revoke_auth_session(uuid) to service_role;
