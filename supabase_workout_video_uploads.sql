insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-videos',
  'workout-videos',
  true,
  125829120,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 125829120,
  allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'];

drop policy if exists "coach workout videos read" on storage.objects;
drop policy if exists "coach workout videos insert" on storage.objects;
drop policy if exists "coach workout videos update" on storage.objects;
drop policy if exists "coach workout videos delete" on storage.objects;

create policy "coach workout videos read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'workout-videos');

create policy "coach workout videos insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'workout-videos');

create policy "coach workout videos update"
on storage.objects for update
to authenticated
using (bucket_id = 'workout-videos')
with check (bucket_id = 'workout-videos');

create policy "coach workout videos delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'workout-videos');
