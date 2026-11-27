-- Superset (Vertical Loading): bài liền nhau cùng chữ cái được tập luân phiên.
-- null = bài đơn. Chỉ một chữ cái in hoa.
alter table session_exercises
  add column if not exists superset_group text
  check (superset_group is null or superset_group ~ '^[A-Z]$');

-- Nhân bản giáo án / lưu mẫu: giữ luôn nhóm superset
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
    insert into session_exercises (session_id, exercise_id, sort_order, sets, reps, duration_sec, weight_kg, rest_sec, notes, superset_group)
    select new_sid, exercise_id, sort_order, sets, reps, duration_sec, weight_kg, rest_sec, notes, superset_group
      from session_exercises where session_id = s.id and client_id is null;
  end loop;
  return pid;
end $$;

grant execute on function clone_workout_plan(uuid, text, uuid, uuid, boolean) to authenticated;
revoke execute on function clone_workout_plan(uuid, text, uuid, uuid, boolean) from anon, public;
