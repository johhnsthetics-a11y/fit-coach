begin;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.workout_sessions'::regclass and conname = 'workout_sessions_student_token_key') then
    alter table public.workout_sessions add constraint workout_sessions_student_token_key unique using index workout_sessions_student_token_uidx;
  end if;
end;
$$;

create or replace function public.validate_workout_execution(p_workout_id uuid, p_execution jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_notes text; v_line text; v_days jsonb; v_day jsonb; v_exercise jsonb;
  v_day_index integer := 0; v_exercise_index integer; v_set integer; v_count integer; v_total integer := 0;
begin
  select notes into v_notes from public.workouts where id = p_workout_id;
  for v_line in select unnest(string_to_array(coalesce(v_notes, ''), E'\n')) loop
    if starts_with(trim(v_line), '[coachfitpro-workout-meta]') then
      v_days := (substr(trim(v_line), length('[coachfitpro-workout-meta]') + 1)::jsonb)->'days';
    end if;
  end loop;
  if v_days is null or jsonb_typeof(v_days) <> 'array' or jsonb_array_length(v_days) = 0 then
    select jsonb_build_array(jsonb_build_object('exercises', coalesce(jsonb_agg(to_jsonb(e) order by e.order_index), '[]'::jsonb)))
      into v_days from public.workout_exercises e where e.workout_id = p_workout_id;
  end if;
  for v_day in select value from jsonb_array_elements(v_days) loop
    v_exercise_index := 0;
    for v_exercise in select value from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb)) loop
      v_count := greatest(1, coalesce(nullif(substring(v_exercise->>'sets' from '^[0-9]+'), '')::integer, 1));
      if v_count > 100 then raise exception using errcode = '22023', message = 'Quantidade de series invalida.'; end if;
      for v_set in 1..v_count loop
        if p_execution->'setLogs'->(v_day_index::text || '-' || v_exercise_index::text || '-' || v_set::text)->'completed' is distinct from 'true'::jsonb then
          raise exception using errcode = '22023', message = 'Conclua todas as series antes de finalizar.';
        end if;
        v_total := v_total + 1;
      end loop;
      v_exercise_index := v_exercise_index + 1;
    end loop;
    v_day_index := v_day_index + 1;
  end loop;
  if v_total = 0 then raise exception using errcode = '22023', message = 'O treino nao possui exercicios.'; end if;
end;
$$;
revoke all on function public.validate_workout_execution(uuid, jsonb) from public, anon, authenticated;

create or replace function public.save_student_workout_session(
  invite_code text,
  selected_workout_id uuid,
  completion_token text,
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
  v_session public.workout_sessions%rowtype;
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
    select 1 from public.students
    where students.id = v_student_id and students.coach_id = v_coach_id
  ) then
    raise exception using errcode = '42501', message = 'Convite do aluno invalido ou expirado.';
  end if;

  if not exists (
    select 1 from public.workouts
    where workouts.id = selected_workout_id
      and workouts.student_id = v_student_id
      and workouts.coach_id = v_coach_id
      and workouts.active is true
  ) then
    raise exception using errcode = '42501', message = 'Este treino nao pertence ao aluno do convite.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':' || completion_token, 0));

  select workout_sessions.* into v_session
  from public.workout_sessions
  where workout_sessions.student_id = v_student_id
    and workout_sessions.completion_token = save_student_workout_session.completion_token
  limit 1;

  if v_session.id is not null and v_session.workout_id <> selected_workout_id then
    raise exception using errcode = '22023', message = 'A sessao pertence a outro treino.';
  end if;

  if v_session.id is not null and v_session.status = 'completed' then
    return to_jsonb(v_session);
  end if;

  if v_session.id is null then
    insert into public.workout_sessions (
      coach_id, student_id, workout_id, completion_token, status, execution
    ) values (
      v_coach_id, v_student_id, selected_workout_id, completion_token, 'in_progress', execution_value
    ) returning * into v_session;
  else
    update public.workout_sessions
    set execution = execution_value,
        updated_at = now()
    where id = v_session.id
      and coalesce(execution_value->>'updatedAt', '') >= coalesce(execution->>'updatedAt', '')
    returning * into v_session;
  end if;

  if v_session.id is null then
    select * into v_session from public.workout_sessions s
    where s.student_id = v_student_id and s.completion_token = save_student_workout_session.completion_token;
  end if;
  return to_jsonb(v_session);
end;
$$;

revoke all on function public.save_student_workout_session(text, uuid, text, jsonb) from public;
grant execute on function public.save_student_workout_session(text, uuid, text, jsonb) to anon, authenticated;

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
    select 1 from public.students
    where students.id = v_student_id and students.coach_id = v_coach_id
  ) then
    raise exception using errcode = '42501', message = 'Convite do aluno invalido ou expirado.';
  end if;

  select workouts.title into v_workout_title
  from public.workouts
  where workouts.id = selected_workout_id
    and workouts.student_id = v_student_id
    and workouts.coach_id = v_coach_id
    and workouts.active is true;

  if v_workout_title is null then
    raise exception using errcode = '42501', message = 'Este treino nao pertence ao aluno do convite.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student_id::text || ':' || completion_token, 0));
  v_marker := '[coachfitpro-completion:' || completion_token || ']';
  select s.* into v_session from public.workout_sessions s
    where s.student_id = v_student_id and s.completion_token = complete_student_workout_session.completion_token
      and s.workout_id = selected_workout_id and s.status = 'completed';
  if v_session.id is not null then
    select l.* into v_log from public.workout_logs l
      where l.student_id = v_student_id and l.workout_id = selected_workout_id
        and position(v_marker in coalesce(l.notes, '')) > 0 limit 1;
    if v_log.id is not null then
      return jsonb_build_object('workout_log', to_jsonb(v_log), 'session', to_jsonb(v_session));
    end if;
  end if;
  perform public.validate_workout_execution(selected_workout_id, execution_value);
  v_execution := execution_value || jsonb_build_object(
    'durationSeconds', greatest(0, coalesce(duration_seconds_value, 0)),
    'updatedAt', now()
  );

  insert into public.workout_sessions (
    coach_id, student_id, workout_id, completion_token, status, execution, completed_at
  ) values (
    v_coach_id, v_student_id, selected_workout_id, completion_token, 'completed', v_execution, now()
  )
  on conflict on constraint workout_sessions_student_token_key do update
  set status = 'completed',
      execution = excluded.execution,
      completed_at = coalesce(public.workout_sessions.completed_at, now()),
      updated_at = now()
  where public.workout_sessions.workout_id = excluded.workout_id
  returning * into v_session;

  if v_session.id is null then
    raise exception using errcode = '22023', message = 'A sessao pertence a outro treino.';
  end if;

  select workout_logs.* into v_log
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

revoke all on function public.complete_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) from public;
grant execute on function public.complete_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) to anon, authenticated;


-- The legacy endpoint has no execution validation and must not bypass the session RPC.
revoke execute on function public.submit_student_workout_log_once(text, uuid, text, text, text, text) from public, anon, authenticated;

commit;
