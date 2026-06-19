create or replace function accept_student_consent(
  invite_code text,
  consent_version_value text default '1.0'
)
returns student_consents
language sql
security definer
set search_path = public
begin atomic
  insert into student_consents (
    coach_id, student_id, invite_id, consent_version, accepted
  )
  select
    si.coach_id,
    si.student_id,
    si.id,
    consent_version_value,
    true
  from student_invites si
  where si.code = invite_code
    and si.status = 'active'
    and si.expires_at > now()
  returning *;
end;

create or replace function submit_student_checkin(
  invite_code text,
  checkin_type text,
  due_label text,
  checkin_state text,
  weight_value text,
  note_value text
)
returns checkins
language sql
security definer
set search_path = public
begin atomic
  insert into checkins (student_id, type, due_label, state, weight, note)
  select
    si.student_id,
    checkin_type,
    due_label,
    checkin_state,
    weight_value,
    note_value
  from student_invites si
  where si.code = invite_code
    and si.status = 'active'
    and si.expires_at > now()
  returning *;
end;

create or replace function submit_student_message(
  invite_code text,
  message_body text
)
returns messages
language sql
security definer
set search_path = public
begin atomic
  insert into messages (coach_id, student_id, sender, body, read)
  select
    si.coach_id,
    si.student_id,
    'student',
    message_body,
    false
  from student_invites si
  where si.code = invite_code
    and si.status = 'active'
    and si.expires_at > now()
  returning *;
end;

create or replace function attach_student_checkin_photo(
  invite_code text,
  selected_checkin_id uuid,
  photo_url text
)
returns checkin_photos
language sql
security definer
set search_path = public
begin atomic
  insert into checkin_photos (checkin_id, storage_url, label)
  select
    c.id,
    photo_url,
    'Foto enviada pelo aluno'
  from student_invites si
  join checkins c on c.student_id = si.student_id
  where si.code = invite_code
    and si.status = 'active'
    and si.expires_at > now()
    and c.id = selected_checkin_id
  returning *;
end;

create or replace function submit_student_workout_log(
  invite_code text,
  selected_workout_id uuid,
  workout_title text,
  effort_value text,
  notes_value text
)
returns workout_logs
language sql
security definer
set search_path = public
begin atomic
  insert into workout_logs (
    coach_id, student_id, workout_id, title, effort, notes
  )
  select
    si.coach_id,
    si.student_id,
    selected_workout_id,
    workout_title,
    effort_value,
    notes_value
  from student_invites si
  where si.code = invite_code
    and si.status = 'active'
    and si.expires_at > now()
    and (
      selected_workout_id is null
      or exists (
        select 1
        from workouts w
        where w.id = selected_workout_id
          and w.student_id = si.student_id
      )
    )
  returning *;
end;
