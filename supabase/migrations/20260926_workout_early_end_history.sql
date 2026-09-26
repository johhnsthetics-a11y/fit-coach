begin;

create or replace function public.end_student_workout_session(
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
set search_path = public, pg_temp
as $$
declare
  v_coach_id uuid;
  v_student_id uuid;
  v_workout_title text;
  v_marker text;
  v_execution jsonb;
  v_session public.workout_sessions%rowtype;
  v_log public.workout_logs%rowtype;
begin
  if completion_token is null or completion_token !~ '^[A-Za-z0-9_-]{12,120}$' then
    raise exception using errcode = '22023', message = 'Sessao de treino invalida.';
  end if;

  if execution_value is null or jsonb_typeof(execution_value) <> 'object' then
    raise exception using errcode = '22023', message = 'Progresso de treino invalido.';
  end if;

  select student_invites.coach_id, student_invites.student_id
  into v_coach_id, v_student_id
  from public.student_invites
  where student_invites.code = trim(invite_code)
    and student_invites.status = 'active'
    and (student_invites.expires_at is null or student_invites.expires_at > now())
  order by student_invites.created_at desc
  limit 1;

  if v_student_id is null or not exists (
    select 1
    from public.students
    where students.id = v_student_id
      and students.coach_id = v_coach_id
  ) then
    raise exception using errcode = '42501', message = 'Convite do aluno invalido ou expirado.';
  end if;

  select workouts.title
  into v_workout_title
  from public.workouts
  where workouts.id = selected_workout_id
    and workouts.student_id = v_student_id
    and workouts.coach_id = v_coach_id
    and workouts.active is true;

  if v_workout_title is null then
    raise exception using errcode = '42501', message = 'Este treino nao pertence ao aluno do convite.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':' || completion_token, 0));
  v_marker := '[coachfitpro-ended-early:' || completion_token || ']';
  v_execution := execution_value || jsonb_build_object(
    'durationSeconds', greatest(0, coalesce(duration_seconds_value, 0)),
    'endedEarly', true,
    'endedEarlyAt', now(),
    'updatedAt', now()
  );

  select workout_sessions.*
  into v_session
  from public.workout_sessions
  where workout_sessions.student_id = v_student_id
    and workout_sessions.completion_token = end_student_workout_session.completion_token
  limit 1;

  if v_session.id is not null and v_session.workout_id <> selected_workout_id then
    raise exception using errcode = '22023', message = 'A sessao pertence a outro treino.';
  end if;

  if v_session.id is not null and v_session.status = 'completed' then
    raise exception using errcode = '22023', message = 'Este treino ja foi finalizado.';
  end if;

  insert into public.workout_sessions (
    coach_id, student_id, workout_id, completion_token, status, execution, completed_at
  ) values (
    v_coach_id, v_student_id, selected_workout_id, completion_token, 'ended_early', v_execution, now()
  )
  on conflict on constraint workout_sessions_student_token_key do update
  set status = 'ended_early',
      execution = excluded.execution,
      completed_at = coalesce(public.workout_sessions.completed_at, now()),
      updated_at = now()
  where public.workout_sessions.workout_id = excluded.workout_id
    and public.workout_sessions.status <> 'completed'
  returning * into v_session;

  if v_session.id is null then
    raise exception using errcode = '22023', message = 'Nao foi possivel encerrar esta sessao.';
  end if;

  select workout_logs.*
  into v_log
  from public.workout_logs
  where workout_logs.coach_id = v_coach_id
    and workout_logs.student_id = v_student_id
    and workout_logs.workout_id = selected_workout_id
    and position(v_marker in coalesce(workout_logs.notes, '')) > 0
  order by workout_logs.completed_at desc nulls last
  limit 1;

  if v_log.id is null then
    insert into public.workout_logs (coach_id, student_id, workout_id, title, effort, notes)
    values (
      v_coach_id,
      v_student_id,
      selected_workout_id,
      coalesce(nullif(v_workout_title, ''), nullif(workout_title, ''), 'Treino'),
      coalesce(nullif(effort_value, ''), 'Moderado'),
      concat_ws(E'\n', nullif(notes_value, ''), v_marker)
    )
    returning * into v_log;
  end if;

  return jsonb_build_object('workout_log', to_jsonb(v_log), 'session', to_jsonb(v_session));
end;
$$;

revoke all on function public.end_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) from public;
grant execute on function public.end_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) to anon, authenticated;

commit;
