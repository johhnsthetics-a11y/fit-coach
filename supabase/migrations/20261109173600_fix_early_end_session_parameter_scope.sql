begin;

-- Após a função pública ser renomeada para *_unchecked, o corpo PL/pgSQL
-- continua guardando a referência qualificada pelo nome público antigo.
do $fix$
declare
  v_sql text;
begin
  select pg_get_functiondef(p.oid)
    into v_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'end_student_workout_session_unchecked'
    and pg_get_function_identity_arguments(p.oid) =
      'invite_code text, selected_workout_id uuid, workout_title text, effort_value text, notes_value text, completion_token text, duration_seconds_value integer, execution_value jsonb';

  if v_sql is null then
    raise exception 'end_student_workout_session_unchecked nao encontrada';
  end if;

  if position('end_student_workout_session.completion_token' in v_sql) = 0
     and position('end_student_workout_session_unchecked.completion_token' in v_sql) = 0 then
    raise exception 'Referencia esperada de completion_token nao encontrada na funcao interna';
  end if;

  v_sql := replace(
    v_sql,
    'end_student_workout_session.completion_token',
    'end_student_workout_session_unchecked.completion_token'
  );
  execute v_sql;
end
$fix$;

commit;
