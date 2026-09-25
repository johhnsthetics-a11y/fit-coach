-- Fix stale self-qualified parameter references left behind after the
-- workout session functions were renamed to *_unchecked.
--
-- Without this correction PostgreSQL raises 42P01 when saving or completing
-- a workout session because the function body still references the old name.

do $fix$
declare
  v_sql text;
begin
  select pg_get_functiondef(p.oid)
    into v_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'save_student_workout_session_unchecked'
    and pg_get_function_identity_arguments(p.oid) =
      'invite_code text, selected_workout_id uuid, completion_token text, execution_value jsonb';

  if v_sql is null then
    raise exception 'save_student_workout_session_unchecked not found';
  end if;

  v_sql := replace(
    v_sql,
    'save_student_workout_session.completion_token',
    'save_student_workout_session_unchecked.completion_token'
  );
  execute v_sql;

  select pg_get_functiondef(p.oid)
    into v_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'complete_student_workout_session_unchecked'
    and pg_get_function_identity_arguments(p.oid) =
      'invite_code text, selected_workout_id uuid, workout_title text, effort_value text, notes_value text, completion_token text, duration_seconds_value integer, execution_value jsonb';

  if v_sql is null then
    raise exception 'complete_student_workout_session_unchecked not found';
  end if;

  v_sql := replace(
    v_sql,
    'complete_student_workout_session.completion_token',
    'complete_student_workout_session_unchecked.completion_token'
  );
  execute v_sql;
end
$fix$;
