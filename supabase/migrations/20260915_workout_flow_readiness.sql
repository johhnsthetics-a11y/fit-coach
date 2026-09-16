begin;

create or replace function public.save_coach_workout(workout_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coach_id uuid := auth.uid();
  v_student_id uuid;
  v_workout_id uuid;
  v_request_id text := nullif(workout_payload ->> 'request_id', '');
  v_publish_marker text;
  v_exercises jsonb := coalesce(workout_payload -> 'exercises', '[]'::jsonb);
  v_is_published boolean := coalesce(workout_payload ->> 'publication_status', 'published') = 'published';
  v_result jsonb;
begin
  if v_coach_id is null then
    raise exception using errcode = '42501', message = 'Sessao do treinador nao identificada.';
  end if;

  if coalesce(workout_payload ->> 'publication_status', 'published') not in ('draft', 'published') then
    raise exception using errcode = '22023', message = 'Estado de publicacao invalido.';
  end if;

  if v_request_id is not null and v_request_id !~ '^[A-Za-z0-9_-]{12,120}$' then
    raise exception using errcode = '22023', message = 'Identificador de publicacao invalido.';
  end if;

  begin
    v_student_id := nullif(workout_payload ->> 'student_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'Aluno invalido para este treino.';
  end;

  if v_student_id is null or not exists (
    select 1 from public.students
    where students.id = v_student_id
      and students.coach_id = v_coach_id
  ) then
    raise exception using errcode = '42501', message = 'O aluno nao pertence ao treinador autenticado.';
  end if;

  if jsonb_typeof(v_exercises) <> 'array' then
    raise exception using errcode = '22023', message = 'A lista de exercicios precisa ser um array.';
  end if;

  begin
    v_workout_id := nullif(workout_payload ->> 'id', '')::uuid;
  exception when invalid_text_representation then
    v_workout_id := null;
  end;

  if v_workout_id is null and v_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_coach_id::text || ':' || v_request_id, 0));
    v_publish_marker := '[coachfitpro-publish:' || v_request_id || ']';

    select workouts.id into v_workout_id
    from public.workouts
    where workouts.coach_id = v_coach_id
      and workouts.student_id = v_student_id
      and position(v_publish_marker in coalesce(workouts.notes, '')) > 0
    order by workouts.created_at desc
    limit 1;
  end if;

  if v_workout_id is not null then
    if not exists (
      select 1 from public.workouts
      where workouts.id = v_workout_id
        and workouts.coach_id = v_coach_id
    ) then
      raise exception using errcode = '42501', message = 'Treino nao encontrado para este treinador.';
    end if;

    update public.workouts
    set student_id = v_student_id,
        title = coalesce(nullif(workout_payload ->> 'title', ''), 'Treino'),
        focus = nullif(workout_payload ->> 'focus', ''),
        notes = nullif(concat_ws(E'\n', nullif(workout_payload ->> 'notes', ''), v_publish_marker), ''),
        active = v_is_published
    where id = v_workout_id
      and coach_id = v_coach_id;
  else
    insert into public.workouts (coach_id, student_id, title, focus, notes, active)
    values (
      v_coach_id,
      v_student_id,
      coalesce(nullif(workout_payload ->> 'title', ''), 'Treino'),
      nullif(workout_payload ->> 'focus', ''),
      nullif(concat_ws(E'\n', nullif(workout_payload ->> 'notes', ''), v_publish_marker), ''),
      v_is_published
    )
    returning id into v_workout_id;
  end if;

  delete from public.workout_exercises where workout_id = v_workout_id;

  insert into public.workout_exercises (
    workout_id, name, sets, reps, load, rest, muscle_group, equipment,
    instructions, video_url, image_url, external_id, order_index
  )
  select
    parsed.workout_id, parsed.name, parsed.sets, parsed.reps, parsed.load,
    parsed.rest, parsed.muscle_group, parsed.equipment, parsed.instructions,
    parsed.video_url, parsed.image_url, parsed.external_id, parsed.order_index
  from jsonb_array_elements(v_exercises) with ordinality as item(exercise, position)
  cross join lateral jsonb_populate_record(
    null::public.workout_exercises,
    item.exercise || jsonb_build_object(
      'workout_id', v_workout_id,
      'name', coalesce(nullif(item.exercise ->> 'name', ''), 'Exercicio'),
      'order_index', (item.position - 1)::integer
    )
  ) as parsed;

  select to_jsonb(workouts_row) || jsonb_build_object(
    'workout_exercises',
    coalesce((
      select jsonb_agg(to_jsonb(exercise_row) order by exercise_row.order_index)
      from public.workout_exercises exercise_row
      where exercise_row.workout_id = v_workout_id
    ), '[]'::jsonb)
  )
  into v_result
  from public.workouts workouts_row
  where workouts_row.id = v_workout_id;

  return v_result;
end;
$$;

revoke all on function public.save_coach_workout(jsonb) from public;
revoke all on function public.save_coach_workout(jsonb) from anon;
grant execute on function public.save_coach_workout(jsonb) to authenticated;

create or replace function public.get_student_workouts(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coach_id uuid;
  v_student_id uuid;
  v_result jsonb;
begin
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
    where students.id = v_student_id
      and students.coach_id = v_coach_id
  ) then
    raise exception using errcode = '42501', message = 'Convite do aluno invalido ou expirado.';
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(workouts) || jsonb_build_object(
        'workout_exercises',
        coalesce((
          select jsonb_agg(to_jsonb(workout_exercises) order by workout_exercises.order_index)
          from public.workout_exercises
          where workout_exercises.workout_id = workouts.id
        ), '[]'::jsonb)
      )
      order by workouts.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.workouts
  where workouts.student_id = v_student_id
    and workouts.coach_id = v_coach_id
    and workouts.active is true;

  return v_result;
end;
$$;

revoke all on function public.get_student_workouts(text) from public;
grant execute on function public.get_student_workouts(text) to anon, authenticated;

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  student_id uuid not null references public.students(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  completion_token text not null,
  status text not null default 'in_progress',
  execution jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists workout_sessions_student_token_uidx
on public.workout_sessions (student_id, completion_token);

create index if not exists workout_sessions_student_workout_status_idx
on public.workout_sessions (student_id, workout_id, status, updated_at desc);

alter table public.workout_sessions enable row level security;

drop policy if exists coach_workout_sessions_select on public.workout_sessions;
create policy coach_workout_sessions_select
on public.workout_sessions for select
to authenticated
using (coach_id = auth.uid());

revoke all on public.workout_sessions from anon;
revoke insert, update, delete on public.workout_sessions from authenticated;
grant select on public.workout_sessions to authenticated;

create or replace function public.get_student_workout_session(
  invite_code text,
  selected_workout_id uuid
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

  select workout_sessions.* into v_session
  from public.workout_sessions
  where workout_sessions.student_id = v_student_id
    and workout_sessions.workout_id = selected_workout_id
    and workout_sessions.status = 'in_progress'
  order by workout_sessions.updated_at desc
  limit 1;

  return case when v_session.id is null then null else to_jsonb(v_session) end;
end;
$$;

revoke all on function public.get_student_workout_session(text, uuid) from public;
grant execute on function public.get_student_workout_session(text, uuid) to anon, authenticated;

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
    and workout_sessions.completion_token = completion_token
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
    returning * into v_session;
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
  v_execution := execution_value || jsonb_build_object(
    'durationSeconds', greatest(0, coalesce(duration_seconds_value, 0)),
    'updatedAt', now()
  );

  insert into public.workout_sessions (
    coach_id, student_id, workout_id, completion_token, status, execution, completed_at
  ) values (
    v_coach_id, v_student_id, selected_workout_id, completion_token, 'completed', v_execution, now()
  )
  on conflict (student_id, completion_token) do update
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

commit;
