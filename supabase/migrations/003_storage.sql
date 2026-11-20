-- ════════════════════════════════════════════════════════════════════════════
-- UR Private Gym — 003: kho file (Supabase Storage)
--
-- client-media     RIÊNG TƯ — ảnh đại diện, ảnh tiến độ, ảnh tư thế.
--                  Đường dẫn: {client_id}/{tên-file}. Chỉ mở qua signed URL có hạn.
-- exercise-media   Ảnh minh hoạ bài tập (không phải dữ liệu sức khoẻ).
--                  Vẫn để riêng tư, chỉ người đã đăng nhập đọc được.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('client-media',   'client-media',   false, 10485760, array['image/jpeg','image/png','image/webp','image/heic']),
  ('exercise-media', 'exercise-media', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- Thư mục đầu tiên của đường dẫn là client_id
create or replace function storage_client_id(path text) returns uuid
language plpgsql immutable as $$
begin
  return (storage.foldername(path))[1]::uuid;
exception when others then
  return null;
end $$;

create policy client_media_select on storage.objects for select to authenticated using (
  bucket_id = 'client-media' and public.can_view_client(public.storage_client_id(name))
);
create policy client_media_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'client-media' and public.can_manage_client(public.storage_client_id(name))
);
create policy client_media_update on storage.objects for update to authenticated using (
  bucket_id = 'client-media' and public.can_manage_client(public.storage_client_id(name))
);
create policy client_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'client-media' and public.can_manage_client(public.storage_client_id(name))
);

create policy exercise_media_select on storage.objects for select to authenticated using (
  bucket_id = 'exercise-media'
);
create policy exercise_media_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'exercise-media' and public.is_staff()
);
create policy exercise_media_update on storage.objects for update to authenticated using (
  bucket_id = 'exercise-media' and (public.is_fm() or owner = auth.uid())
);
create policy exercise_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'exercise-media' and (public.is_fm() or owner = auth.uid())
);
