update storage.buckets
set public = false
where id = 'checkin-photos';

drop policy if exists "prototype checkin photos read" on storage.objects;
drop policy if exists "prototype checkin photos insert" on storage.objects;
drop policy if exists "prototype checkin photos update" on storage.objects;
drop policy if exists "prototype checkin photos delete" on storage.objects;
drop policy if exists "student invite can upload checkin photos" on storage.objects;
drop policy if exists "student invite can read checkin photos" on storage.objects;
drop policy if exists "coach can read checkin photos" on storage.objects;
drop policy if exists "coach can upload checkin photos" on storage.objects;
drop policy if exists "coach can update checkin photos" on storage.objects;
drop policy if exists "coach can delete checkin photos" on storage.objects;

create policy "student invite can read checkin photos"
on storage.objects for select
to anon
using (
  bucket_id = 'checkin-photos'
  and exists (
    select 1
    from student_invites
    where student_invites.code = split_part(storage.objects.name, '/', 1)
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can upload checkin photos"
on storage.objects for insert
to anon
with check (
  bucket_id = 'checkin-photos'
  and exists (
    select 1
    from student_invites
    where student_invites.code = split_part(storage.objects.name, '/', 1)
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "coach can read checkin photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'checkin-photos'
  and exists (
    select 1
    from checkins
    join students on students.id = checkins.student_id
    where checkins.id::text in (
        split_part(storage.objects.name, '/', 1),
        split_part(storage.objects.name, '/', 2)
      )
      and students.coach_id = auth.uid()
  )
);

create policy "coach can upload checkin photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'checkin-photos'
  and exists (
    select 1
    from checkins
    join students on students.id = checkins.student_id
    where checkins.id::text = split_part(storage.objects.name, '/', 1)
      and students.coach_id = auth.uid()
  )
);

create policy "coach can update checkin photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'checkin-photos'
  and exists (
    select 1
    from checkins
    join students on students.id = checkins.student_id
    where checkins.id::text in (
        split_part(storage.objects.name, '/', 1),
        split_part(storage.objects.name, '/', 2)
      )
      and students.coach_id = auth.uid()
  )
)
with check (bucket_id = 'checkin-photos');

create policy "coach can delete checkin photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'checkin-photos'
  and exists (
    select 1
    from checkins
    join students on students.id = checkins.student_id
    where checkins.id::text in (
        split_part(storage.objects.name, '/', 1),
        split_part(storage.objects.name, '/', 2)
      )
      and students.coach_id = auth.uid()
  )
);
