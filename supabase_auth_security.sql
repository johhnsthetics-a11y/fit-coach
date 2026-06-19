alter table users enable row level security;
alter table students enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table checkins enable row level security;
alter table checkin_photos enable row level security;
alter table notifications enable row level security;

drop policy if exists "prototype users access" on users;
drop policy if exists "prototype students access" on students;
drop policy if exists "prototype plans access" on plans;
drop policy if exists "prototype subscriptions access" on subscriptions;
drop policy if exists "prototype payments access" on payments;
drop policy if exists "prototype checkins access" on checkins;
drop policy if exists "prototype checkin photos access" on checkin_photos;
drop policy if exists "prototype notifications access" on notifications;

drop policy if exists "coach can manage own profile" on users;
drop policy if exists "coach can manage own students" on students;
drop policy if exists "authenticated can read active plans" on plans;
drop policy if exists "coach can manage own subscriptions" on subscriptions;
drop policy if exists "coach can manage own payments" on payments;
drop policy if exists "coach can manage own checkins" on checkins;
drop policy if exists "coach can manage own checkin photos" on checkin_photos;
drop policy if exists "coach can manage own notifications" on notifications;

update students
set coach_id = auth_users.id
from auth.users auth_users
join users app_users on app_users.email = auth_users.email
where students.coach_id = app_users.id
  and app_users.id <> auth_users.id;

update notifications
set user_id = auth_users.id
from auth.users auth_users
join users app_users on app_users.email = auth_users.email
where notifications.user_id = app_users.id
  and app_users.id <> auth_users.id;

update users
set id = auth_users.id
from auth.users auth_users
where users.email = auth_users.email
  and users.id <> auth_users.id;

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

create policy "authenticated can read active plans"
on plans for select
to authenticated
using (active = true);

create policy "coach can manage own subscriptions"
on subscriptions for all
to authenticated
using (
  exists (
    select 1 from students
    where students.id = subscriptions.student_id
      and students.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from students
    where students.id = subscriptions.student_id
      and students.coach_id = auth.uid()
  )
);

create policy "coach can manage own payments"
on payments for all
to authenticated
using (
  exists (
    select 1
    from subscriptions
    join students on students.id = subscriptions.student_id
    where subscriptions.id = payments.subscription_id
      and students.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from subscriptions
    join students on students.id = subscriptions.student_id
    where subscriptions.id = payments.subscription_id
      and students.coach_id = auth.uid()
  )
);

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

drop policy if exists "prototype checkin photos read" on storage.objects;
drop policy if exists "prototype checkin photos insert" on storage.objects;
drop policy if exists "prototype checkin photos update" on storage.objects;
drop policy if exists "prototype checkin photos delete" on storage.objects;
drop policy if exists "authenticated checkin photos read" on storage.objects;
drop policy if exists "authenticated checkin photos insert" on storage.objects;
drop policy if exists "authenticated checkin photos update" on storage.objects;
drop policy if exists "authenticated checkin photos delete" on storage.objects;

create policy "authenticated checkin photos read"
on storage.objects for select
to authenticated
using (bucket_id = 'checkin-photos');

create policy "authenticated checkin photos insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'checkin-photos');

create policy "authenticated checkin photos update"
on storage.objects for update
to authenticated
using (bucket_id = 'checkin-photos')
with check (bucket_id = 'checkin-photos');

create policy "authenticated checkin photos delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'checkin-photos');
