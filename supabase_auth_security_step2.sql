alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;

drop policy if exists "prototype plans access" on plans;
drop policy if exists "prototype subscriptions access" on subscriptions;
drop policy if exists "prototype payments access" on payments;

drop policy if exists "authenticated can read active plans" on plans;
drop policy if exists "coach can manage own subscriptions" on subscriptions;
drop policy if exists "coach can manage own payments" on payments;

create policy "authenticated can read active plans"
on plans for select
to authenticated
using (active = true);

create policy "coach can manage own subscriptions"
on subscriptions for all
to authenticated
using (
  exists (
    select 1
    from students
    where students.id = subscriptions.student_id
      and students.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from students
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
