create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.coachfit_valid_student_checkin_photo_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_invites as invite
    join public.checkins as checkin
      on checkin.student_id = invite.student_id
    where invite.code = split_part(object_name, '/', 1)
      and checkin.id::text = split_part(object_name, '/', 2)
      and invite.status = 'active'
      and invite.expires_at > now()
  );
$$;

revoke all on function private.coachfit_valid_student_checkin_photo_path(text) from public;
grant execute on function private.coachfit_valid_student_checkin_photo_path(text) to anon, authenticated;

drop policy if exists "student invite can read checkin photos" on storage.objects;
drop policy if exists "student invite can upload checkin photos" on storage.objects;

create policy "student invite can read checkin photos"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'checkin-photos'
  and private.coachfit_valid_student_checkin_photo_path(storage.objects.name)
);

create policy "student invite can upload checkin photos"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'checkin-photos'
  and private.coachfit_valid_student_checkin_photo_path(storage.objects.name)
);
