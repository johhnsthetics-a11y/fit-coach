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

create policy "prototype users access"
on users for all
to anon, authenticated
using (true)
with check (true);

create policy "prototype students access"
on students for all
to anon, authenticated
using (true)
with check (true);

create policy "prototype plans access"
on plans for all
to anon, authenticated
using (true)
with check (true);

create policy "prototype subscriptions access"
on subscriptions for all
to anon, authenticated
using (true)
with check (true);

create policy "prototype payments access"
on payments for all
to anon, authenticated
using (true)
with check (true);

create policy "prototype checkins access"
on checkins for all
to anon, authenticated
using (true)
with check (true);

create policy "prototype checkin photos access"
on checkin_photos for all
to anon, authenticated
using (true)
with check (true);

create policy "prototype notifications access"
on notifications for all
to anon, authenticated
using (true)
with check (true);
