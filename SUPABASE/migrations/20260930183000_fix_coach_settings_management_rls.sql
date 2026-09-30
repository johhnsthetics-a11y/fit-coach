begin;

alter table public.coach_settings enable row level security;

revoke insert, update, delete on table public.coach_settings from anon;
grant select, insert, update on table public.coach_settings to authenticated;

drop policy if exists "coach can manage own settings" on public.coach_settings;
drop policy if exists "coach_settings_select_own" on public.coach_settings;
drop policy if exists "coach_settings_insert_own" on public.coach_settings;
drop policy if exists "coach_settings_update_own" on public.coach_settings;

create policy "coach_settings_select_own"
on public.coach_settings
for select
to authenticated
using ((select auth.uid()) = coach_id);

create policy "coach_settings_insert_own"
on public.coach_settings
for insert
to authenticated
with check ((select auth.uid()) = coach_id);

create policy "coach_settings_update_own"
on public.coach_settings
for update
to authenticated
using ((select auth.uid()) = coach_id)
with check ((select auth.uid()) = coach_id);

commit;
