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

create or replace function public.coachfit_delete_public_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.users where id = old.id;

  if old.email is not null and to_regclass('public.payment_webhook_events') is not null then
    execute 'update public.payment_webhook_events
      set buyer_email = null,
          payload = jsonb_build_object(''account_deleted'', true)
      where lower(buyer_email) = lower($1)'
    using old.email;
  end if;

  return old;
end;
$$;

drop trigger if exists coachfit_delete_public_user on auth.users;
create trigger coachfit_delete_public_user
after delete on auth.users
for each row execute function public.coachfit_delete_public_user();

revoke all on function public.coachfit_delete_public_user() from public, anon, authenticated;
