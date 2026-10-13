begin;

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

  select 'profile-avatars'::text, settings.profile_avatar_path::text
  from public.coach_settings as settings
  where settings.coach_id = auth.uid()
    and nullif(btrim(settings.profile_avatar_path), '') is not null

  union

  select 'profile-avatars'::text, students.avatar_path::text
  from public.students as students
  where (students.coach_id = auth.uid() or students.auth_user_id = auth.uid())
    and nullif(btrim(students.avatar_path), '') is not null

  union

  select 'checkin-photos'::text, photos.storage_url::text
  from public.checkin_photos as photos
  join public.checkins as checkins on checkins.id = photos.checkin_id
  join public.students as students on students.id = checkins.student_id
  where (students.coach_id = auth.uid() or students.auth_user_id = auth.uid())
    and nullif(btrim(photos.storage_url), '') is not null

  union

  select 'message-attachments'::text, messages.attachment_url::text
  from public.messages as messages
  where (
      messages.coach_id = auth.uid()
      or exists (
        select 1
        from public.students as students
        where students.id = messages.student_id
          and students.auth_user_id = auth.uid()
      )
    )
    and nullif(btrim(messages.attachment_url), '') is not null

  union

  select 'workout-videos'::text, exercises.video_url::text
  from public.workout_exercises as exercises
  join public.workouts as workouts on workouts.id = exercises.workout_id
  where workouts.coach_id = auth.uid()
    and nullif(btrim(exercises.video_url), '') is not null;
$$;

revoke all on function public.coachfit_account_storage_references() from public, anon, authenticated;
grant execute on function public.coachfit_account_storage_references() to authenticated;

revoke all on function public.coachfit_protect_user_role() from public, anon, authenticated;
revoke all on function public.create_coach_subscription() from public, anon, authenticated;
revoke all on function public.coachfit_prepare_student_billing() from public, anon, authenticated;

commit;
