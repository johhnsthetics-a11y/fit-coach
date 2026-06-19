drop policy if exists "student invite can read linked student" on students;
drop policy if exists "student invite can read linked checkins" on checkins;
drop policy if exists "student invite can create checkins" on checkins;
drop policy if exists "student invite can read linked checkin photos" on checkin_photos;
drop policy if exists "student invite can create checkin photos" on checkin_photos;

create policy "student invite can read linked student"
on students for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = students.id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can read linked checkins"
on checkins for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = checkins.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can create checkins"
on checkins for insert
to anon, authenticated
with check (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = checkins.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can read linked checkin photos"
on checkin_photos for select
to anon, authenticated
using (
  exists (
    select 1
    from checkins
    join student_invites on student_invites.student_id = checkins.student_id
    where checkins.id = checkin_photos.checkin_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can create checkin photos"
on checkin_photos for insert
to anon, authenticated
with check (
  exists (
    select 1
    from checkins
    join student_invites on student_invites.student_id = checkins.student_id
    where checkins.id = checkin_photos.checkin_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

drop policy if exists "student invite can upload checkin photos" on storage.objects;

create policy "student invite can upload checkin photos"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'checkin-photos');
