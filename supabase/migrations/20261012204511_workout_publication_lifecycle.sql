begin;

alter table public.workouts
add column if not exists publication_status text;

-- Legacy rows only stored active=false for both drafts and archived workouts.
-- Preserve recoverability unless a completed execution proves the workout was published.
update public.workouts as workout
set publication_status = case
  when workout.active is not false then 'published'
  when exists (
    select 1
    from public.workout_logs as workout_log
    where workout_log.workout_id = workout.id
  ) then 'archived'
  else 'draft'
end
where workout.publication_status is null;

alter table public.workouts
alter column publication_status set default 'published';

alter table public.workouts
alter column publication_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workouts_publication_status_check'
      and conrelid = 'public.workouts'::regclass
  ) then
    alter table public.workouts
    add constraint workouts_publication_status_check
    check (publication_status in ('draft', 'published', 'archived'));
  end if;
end
$$;

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
  v_publication_status text := lower(coalesce(nullif(workout_payload ->> 'publication_status', ''), 'published'));
  v_is_published boolean;
  v_result jsonb;
begin
  if v_coach_id is null then
    raise exception using errcode = '42501', message = 'Sessao do treinador nao identificada.';
  end if;

  if v_publication_status not in ('draft', 'published') then
    raise exception using errcode = '22023', message = 'Estado de publicacao invalido.';
  end if;
  v_is_published := v_publication_status = 'published';

  if v_request_id is not null and v_request_id !~ '^[A-Za-z0-9_-]{12,120}$' then
    raise exception using errcode = '22023', message = 'Identificador de publicacao invalido.';
  end if;

  begin
    v_student_id := nullif(workout_payload ->> 'student_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'Aluno invalido para este treino.';
  end;

  if v_student_id is null or not exists (
    select 1
    from public.students
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

    select workouts.id
    into v_workout_id
    from public.workouts
    where workouts.coach_id = v_coach_id
      and workouts.student_id = v_student_id
      and position(v_publish_marker in coalesce(workouts.notes, '')) > 0
    order by workouts.created_at desc
    limit 1;
  end if;

  if v_workout_id is not null then
    if not exists (
      select 1
      from public.workouts
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
        active = v_is_published,
        publication_status = v_publication_status
    where id = v_workout_id
      and coach_id = v_coach_id;
  else
    insert into public.workouts (
      coach_id,
      student_id,
      title,
      focus,
      notes,
      active,
      publication_status
    )
    values (
      v_coach_id,
      v_student_id,
      coalesce(nullif(workout_payload ->> 'title', ''), 'Treino'),
      nullif(workout_payload ->> 'focus', ''),
      nullif(concat_ws(E'\n', nullif(workout_payload ->> 'notes', ''), v_publish_marker), ''),
      v_is_published,
      v_publication_status
    )
    returning id into v_workout_id;
  end if;

  delete from public.workout_exercises
  where workout_id = v_workout_id;

  insert into public.workout_exercises (
    workout_id,
    name,
    sets,
    reps,
    load,
    rest,
    muscle_group,
    equipment,
    instructions,
    video_url,
    image_url,
    external_id,
    order_index
  )
  select
    parsed.workout_id,
    parsed.name,
    parsed.sets,
    parsed.reps,
    parsed.load,
    parsed.rest,
    parsed.muscle_group,
    parsed.equipment,
    parsed.instructions,
    parsed.video_url,
    parsed.image_url,
    parsed.external_id,
    parsed.order_index
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

commit;
