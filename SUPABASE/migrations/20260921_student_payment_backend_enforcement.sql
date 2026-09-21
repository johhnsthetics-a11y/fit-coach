create or replace function public.coachfit_student_financial_access_by_invite(p_invite_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_invites as invites
    join public.students as students
      on students.id = invites.student_id
     and students.coach_id = invites.coach_id
    where invites.code = trim(p_invite_code)
      and invites.status = 'active'
      and (invites.expires_at is null or invites.expires_at > now())
      and (
        (students.payment = 'Pago' and students.app_payment_status = 'active')
        or students.access_override_until > now()
      )
  );
$$;

revoke all on function public.coachfit_student_financial_access_by_invite(text) from public, anon, authenticated;

alter function public.get_student_portal(text) rename to get_student_portal_unchecked;
alter function public.get_student_workouts(text) rename to get_student_workouts_unchecked;
alter function public.get_student_workout_session(text, uuid) rename to get_student_workout_session_unchecked;
alter function public.save_student_workout_session(text, uuid, text, jsonb) rename to save_student_workout_session_unchecked;
alter function public.complete_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) rename to complete_student_workout_session_unchecked;
alter function public.student_nutrition_questionnaires(text) rename to student_nutrition_questionnaires_unchecked;
alter function public.submit_nutrition_questionnaire(text, uuid, jsonb) rename to submit_nutrition_questionnaire_unchecked;
alter function public.submit_student_checkin(text, text, text, text, text, text) rename to submit_student_checkin_unchecked;

revoke all on function public.get_student_portal_unchecked(text) from public, anon, authenticated;
revoke all on function public.get_student_workouts_unchecked(text) from public, anon, authenticated;
revoke all on function public.get_student_workout_session_unchecked(text, uuid) from public, anon, authenticated;
revoke all on function public.save_student_workout_session_unchecked(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.complete_student_workout_session_unchecked(text, uuid, text, text, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.student_nutrition_questionnaires_unchecked(text) from public, anon, authenticated;
revoke all on function public.submit_nutrition_questionnaire_unchecked(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.submit_student_checkin_unchecked(text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.get_student_portal(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  portal jsonb;
  access_open boolean;
begin
  portal := public.get_student_portal_unchecked(invite_code);
  if portal is null then
    return null;
  end if;

  access_open := public.coachfit_student_financial_access_by_invite(invite_code);
  if access_open then
    return portal || jsonb_build_object('financial_access_open', true);
  end if;

  return portal || jsonb_build_object(
    'financial_access_open', false,
    'checkins', '[]'::jsonb,
    'workouts', '[]'::jsonb,
    'nutrition_plans', '[]'::jsonb,
    'workout_logs', '[]'::jsonb,
    'appointments', '[]'::jsonb,
    'assessments', '[]'::jsonb
  );
end;
$$;

create or replace function public.get_student_workouts(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente.' using errcode = '42501';
  end if;
  return public.get_student_workouts_unchecked(invite_code);
end;
$$;

create or replace function public.get_student_workout_session(invite_code text, selected_workout_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente.' using errcode = '42501';
  end if;
  return public.get_student_workout_session_unchecked(invite_code, selected_workout_id);
end;
$$;

create or replace function public.save_student_workout_session(invite_code text, selected_workout_id uuid, completion_token text, execution_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente.' using errcode = '42501';
  end if;
  return public.save_student_workout_session_unchecked(invite_code, selected_workout_id, completion_token, execution_value);
end;
$$;

create or replace function public.complete_student_workout_session(
  invite_code text,
  selected_workout_id uuid,
  workout_title text,
  effort_value text,
  notes_value text,
  completion_token text,
  duration_seconds_value integer,
  execution_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente.' using errcode = '42501';
  end if;
  return public.complete_student_workout_session_unchecked(
    invite_code,
    selected_workout_id,
    workout_title,
    effort_value,
    notes_value,
    completion_token,
    duration_seconds_value,
    execution_value
  );
end;
$$;

create or replace function public.student_nutrition_questionnaires(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    return '[]'::jsonb;
  end if;
  return public.student_nutrition_questionnaires_unchecked(invite_code);
end;
$$;

create or replace function public.submit_nutrition_questionnaire(invite_code text, selected_assignment_id uuid, answers_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente.' using errcode = '42501';
  end if;
  return public.submit_nutrition_questionnaire_unchecked(invite_code, selected_assignment_id, answers_value);
end;
$$;

create or replace function public.submit_student_checkin(
  invite_code text,
  checkin_type text,
  due_label text,
  checkin_state text,
  weight_value text,
  note_value text
)
returns public.checkins
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente.' using errcode = '42501';
  end if;
  return public.submit_student_checkin_unchecked(invite_code, checkin_type, due_label, checkin_state, weight_value, note_value);
end;
$$;

revoke all on function public.get_student_portal(text) from public;
revoke all on function public.get_student_workouts(text) from public;
revoke all on function public.get_student_workout_session(text, uuid) from public;
revoke all on function public.save_student_workout_session(text, uuid, text, jsonb) from public;
revoke all on function public.complete_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) from public;
revoke all on function public.student_nutrition_questionnaires(text) from public;
revoke all on function public.submit_nutrition_questionnaire(text, uuid, jsonb) from public;
revoke all on function public.submit_student_checkin(text, text, text, text, text, text) from public;

grant execute on function public.get_student_portal(text) to anon, authenticated;
grant execute on function public.get_student_workouts(text) to anon, authenticated;
grant execute on function public.get_student_workout_session(text, uuid) to anon, authenticated;
grant execute on function public.save_student_workout_session(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.complete_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) to anon, authenticated;
grant execute on function public.student_nutrition_questionnaires(text) to anon, authenticated;
grant execute on function public.submit_nutrition_questionnaire(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.submit_student_checkin(text, text, text, text, text, text) to anon, authenticated;
