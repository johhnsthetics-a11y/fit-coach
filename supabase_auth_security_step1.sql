alter table users enable row level security;
alter table students enable row level security;
alter table checkins enable row level security;
alter table checkin_photos enable row level security;
alter table notifications enable row level security;

drop policy if exists "prototype users access" on users;
drop policy if exists "prototype students access" on students;
drop policy if exists "prototype checkins access" on checkins;
drop policy if exists "prototype checkin photos access" on checkin_photos;
drop policy if exists "prototype notifications access" on notifications;

drop policy if exists "coach can manage own profile" on users;
drop policy if exists "coach can manage own students" on students;
drop policy if exists "coach can manage own checkins" on checkins;
drop policy if exists "coach can manage own checkin photos" on checkin_photos;
drop policy if exists "coach can manage own notifications" on notifications;

create policy "coach can manage own profile"
on users for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "coach can manage own students"
on students for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "coach can manage own checkins"
on checkins for all
to authenticated
using (
  exists (
    select 1 from students
    where students.id = checkins.student_id
      and students.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from students
    where students.id = checkins.student_id
      and students.coach_id = auth.uid()
  )
);

create policy "coach can manage own checkin photos"
on checkin_photos for all
to authenticated
using (
  exists (
    select 1
    from checkins
    join students on students.id = checkins.student_id
    where checkins.id = checkin_photos.checkin_id
      and students.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from checkins
    join students on students.id = checkins.student_id
    where checkins.id = checkin_photos.checkin_id
      and students.coach_id = auth.uid()
  )
);

create policy "coach can manage own notifications"
on notifications for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
