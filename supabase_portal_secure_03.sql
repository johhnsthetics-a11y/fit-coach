grant execute on function get_student_portal(text) to anon, authenticated;
grant execute on function accept_student_consent(text, text) to anon, authenticated;
grant execute on function submit_student_checkin(text, text, text, text, text, text) to anon, authenticated;
grant execute on function submit_student_message(text, text) to anon, authenticated;
grant execute on function attach_student_checkin_photo(text, uuid, text) to anon, authenticated;
grant execute on function submit_student_workout_log(text, uuid, text, text, text) to anon, authenticated;

drop policy if exists "public can read active student invite by code" on student_invites;
drop policy if exists "student invite can read linked student" on students;
drop policy if exists "student invite can read linked checkins" on checkins;
drop policy if exists "student invite can create checkins" on checkins;
drop policy if exists "student invite can read linked checkin photos" on checkin_photos;
drop policy if exists "student invite can create checkin photos" on checkin_photos;
drop policy if exists "student invite can read workouts" on workouts;
drop policy if exists "student invite can read workout exercises" on workout_exercises;
drop policy if exists "student invite can read nutrition plans" on nutrition_plans;
drop policy if exists "student invite can read nutrition meals" on nutrition_meals;
drop policy if exists "student invite can read own workout logs" on workout_logs;
drop policy if exists "student invite can create workout logs" on workout_logs;
drop policy if exists "student invite can read own messages" on messages;
drop policy if exists "student invite can create own messages" on messages;
drop policy if exists "student invite can read own appointments" on appointments;
drop policy if exists "student invite can read own invoices" on invoices;
drop policy if exists "student invite can read own assessments" on assessments;
drop policy if exists "student invite can read coach settings" on coach_settings;

drop policy if exists "prototype checkin photos insert" on storage.objects;
drop policy if exists "prototype checkin photos update" on storage.objects;
drop policy if exists "prototype checkin photos delete" on storage.objects;
drop policy if exists "student invite can upload checkin photos" on storage.objects;
drop policy if exists "coach can upload checkin photos" on storage.objects;
drop policy if exists "coach can update checkin photos" on storage.objects;
drop policy if exists "coach can delete checkin photos" on storage.objects;

create policy "student invite can upload checkin photos"
on storage.objects for insert
to anon
with check (
  bucket_id = 'checkin-photos'
  and exists (
    select 1
    from student_invites
    where student_invites.code = split_part(storage.objects.name, '/', 1)
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "coach can upload checkin photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'checkin-photos');

create policy "coach can update checkin photos"
on storage.objects for update
to authenticated
using (bucket_id = 'checkin-photos')
with check (bucket_id = 'checkin-photos');

create policy "coach can delete checkin photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'checkin-photos');
