update storage.buckets set public = false where id = 'workout-videos';

drop policy if exists "coach workout videos read" on storage.objects;
drop policy if exists "coach workout videos insert" on storage.objects;
drop policy if exists "coach workout videos update" on storage.objects;
drop policy if exists "coach workout videos delete" on storage.objects;

create policy "coach workout videos read" on storage.objects
for select to authenticated using (
  bucket_id = 'workout-videos'
  and exists (
    select 1 from public.workouts w
    where w.id::text = split_part(storage.objects.name, '/', 1)
      and w.coach_id = (select auth.uid())
  )
);
create policy "coach workout videos insert" on storage.objects
for insert to authenticated with check (
  bucket_id = 'workout-videos'
  and exists (
    select 1 from public.workouts w
    where w.id::text = split_part(storage.objects.name, '/', 1)
      and w.coach_id = (select auth.uid())
  )
);
create policy "coach workout videos update" on storage.objects
for update to authenticated using (
  bucket_id = 'workout-videos'
  and exists (
    select 1 from public.workouts w
    where w.id::text = split_part(storage.objects.name, '/', 1)
      and w.coach_id = (select auth.uid())
  )
) with check (
  bucket_id = 'workout-videos'
  and exists (
    select 1 from public.workouts w
    where w.id::text = split_part(storage.objects.name, '/', 1)
      and w.coach_id = (select auth.uid())
  )
);
create policy "coach workout videos delete" on storage.objects
for delete to authenticated using (
  bucket_id = 'workout-videos'
  and exists (
    select 1 from public.workouts w
    where w.id::text = split_part(storage.objects.name, '/', 1)
      and w.coach_id = (select auth.uid())
  )
);

drop policy if exists "authenticated checkin photos read" on storage.objects;
drop policy if exists "authenticated checkin photos insert" on storage.objects;
drop policy if exists "authenticated checkin photos update" on storage.objects;
drop policy if exists "authenticated checkin photos delete" on storage.objects;
