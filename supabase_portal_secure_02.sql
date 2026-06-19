create or replace function accept_student_consent(
  invite_code text,
  consent_version_value text default '1.0'
)
returns student_consents
language plpgsql
security definer
set search_path = public
as $consent$
declare
  active_invite student_invites%rowtype;
  saved student_consents%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  insert into student_consents (
    coach_id, student_id, invite_id, consent_version, accepted
  )
  values (
    active_invite.coach_id,
    active_invite.student_id,
    active_invite.id,
    consent_version_value,
    true
  )
  returning * into saved;

  return saved;
end;
$consent$;

create or replace function submit_student_checkin(
  invite_code text,
  checkin_type text,
  due_label text,
  checkin_state text,
  weight_value text,
  note_value text
)
returns checkins
language plpgsql
security definer
set search_path = public
as $checkin$
declare
  active_invite student_invites%rowtype;
  saved checkins%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  insert into checkins (student_id, type, due_label, state, weight, note)
  values (active_invite.student_id, checkin_type, due_label, checkin_state, weight_value, note_value)
  returning * into saved;

  return saved;
end;
$checkin$;

create or replace function submit_student_message(invite_code text, message_body text)
returns messages
language plpgsql
security definer
set search_path = public
as $message$
declare
  active_invite student_invites%rowtype;
  saved messages%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  insert into messages (coach_id, student_id, sender, body, read)
  values (active_invite.coach_id, active_invite.student_id, 'student', message_body, false)
  returning * into saved;

  return saved;
end;
$message$;

create or replace function attach_student_checkin_photo(
  invite_code text,
  selected_checkin_id uuid,
  photo_url text
)
returns checkin_photos
language plpgsql
security definer
set search_path = public
as $photo$
declare
  active_invite student_invites%rowtype;
  saved checkin_photos%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  if not exists (
    select 1 from checkins
    where id = selected_checkin_id
      and student_id = active_invite.student_id
  ) then
    raise exception 'Check-in invalido para este aluno';
  end if;

  insert into checkin_photos (checkin_id, storage_url, label)
  values (selected_checkin_id, photo_url, 'Foto enviada pelo aluno')
  returning * into saved;

  return saved;
end;
$photo$;

create or replace function submit_student_workout_log(
  invite_code text,
  selected_workout_id uuid,
  workout_title text,
  effort_value text,
  notes_value text
)
returns workout_logs
language plpgsql
security definer
set search_path = public
as $workout$
declare
  active_invite student_invites%rowtype;
  saved workout_logs%rowtype;
begin
  select * into active_invite
  from student_invites
  where code = invite_code and status = 'active' and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  if selected_workout_id is not null and not exists (
    select 1 from workouts
    where id = selected_workout_id
      and student_id = active_invite.student_id
  ) then
    raise exception 'Treino invalido para este aluno';
  end if;

  insert into workout_logs (coach_id, student_id, workout_id, title, effort, notes)
  values (
    active_invite.coach_id,
    active_invite.student_id,
    selected_workout_id,
    workout_title,
    effort_value,
    notes_value
  )
  returning * into saved;

  return saved;
end;
$workout$;
