-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 004: cổng kiểm tra thiết bị cho proxy.ts
-- Một lần gọi trả về vai trò + trạng thái thiết bị hiện tại, đồng thời cập nhật
-- "lần dùng gần nhất" (tối đa 5 phút/lần để đỡ ghi).
--   ok       thiết bị đã xác nhận qua email, còn hiệu lực
--   revoked  đã bị đăng xuất từ xa / đã đăng xuất → bắt đăng nhập lại
--   unknown  phiên không gắn với thiết bị nào → bắt đăng nhập lại
-- Không trả dòng nào = chưa đăng nhập hoặc tài khoản bị khoá.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function session_gate(dkey text)
returns table (role user_role, device_status text)
language plpgsql volatile security definer set search_path = public as $$
begin
  update devices set last_seen = now()
   where user_id = auth.uid() and device_key = dkey and revoked_at is null
     and last_seen < now() - interval '5 minutes';

  return query
    select p.role,
           case when d.id is null then 'unknown'
                when d.revoked_at is not null then 'revoked'
                else 'ok' end
      from profiles p
      left join devices d on d.user_id = p.id and d.device_key = dkey
     where p.id = auth.uid() and p.is_active;
end $$;

revoke all on function session_gate(text) from public, anon;
grant execute on function session_gate(text) to authenticated;
