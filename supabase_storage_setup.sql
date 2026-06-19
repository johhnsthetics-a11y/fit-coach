insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "prototype checkin photos read" on storage.objects;
drop policy if exists "prototype checkin photos insert" on storage.objects;
drop policy if exists "prototype checkin photos update" on storage.objects;
drop policy if exists "prototype checkin photos delete" on storage.objects;

create policy "prototype checkin photos read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'checkin-photos');

create policy "prototype checkin photos insert"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'checkin-photos');

create policy "prototype checkin photos update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'checkin-photos')
with check (bucket_id = 'checkin-photos');

create policy "prototype checkin photos delete"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'checkin-photos');
