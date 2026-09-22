begin;

alter table public.students
  add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.coachfit_account_storage_references()
returns table (bucket_id text, storage_value text)
language sql
stable
security definer
set search_path = ''
as $$
  select objects.bucket_id::text, objects.name::text
  from storage.objects as objects
  where objects.owner_id::text = auth.uid()::text

  union

  select 'profile-avatars'::text, students.avatar_path::text
  from public.students as students
  where students.coach_id = auth.uid()
    and nullif(btrim(students.avatar_path), '') is not null

  union

  select 'checkin-photos'::text, photos.storage_url::text
  from public.checkin_photos as photos
  join public.checkins as checkins on checkins.id = photos.checkin_id
  join public.students as students on students.id = checkins.student_id
  where students.coach_id = auth.uid()
    and nullif(btrim(photos.storage_url), '') is not null

  union

  select 'message-attachments'::text, messages.attachment_url::text
  from public.messages as messages
  where messages.coach_id = auth.uid()
    and nullif(btrim(messages.attachment_url), '') is not null

  union

  select 'workout-videos'::text, exercises.video_url::text
  from public.workout_exercises as exercises
  join public.workouts as workouts on workouts.id = exercises.workout_id
  where workouts.coach_id = auth.uid()
    and nullif(btrim(exercises.video_url), '') is not null;
$$;

revoke all on function public.coachfit_account_storage_references() from public, anon;
grant execute on function public.coachfit_account_storage_references() to authenticated;

commit;

