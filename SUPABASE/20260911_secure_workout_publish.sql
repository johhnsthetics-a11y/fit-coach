begin;

alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_logs enable row level security;

drop policy if exists coach_workouts_select on public.workouts;
create policy coach_workouts_select
on public.workouts for select
to authenticated
using (coach_id = auth.uid());

drop policy if exists coach_workouts_insert on public.workouts;
create policy coach_workouts_insert
on public.workouts for insert
to authenticated
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.students
    where students.id = workouts.student_id
      and students.coach_id = auth.uid()
  )
);

drop policy if exists coach_workouts_update on public.workouts;
create policy coach_workouts_update
on public.workouts for update
to authenticated
using (coach_id = auth.uid())
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.students
    where students.id = workouts.student_id
      and students.coach_id = auth.uid()
  )
);

drop policy if exists coach_workouts_delete on public.workouts;
create policy coach_workouts_delete
on public.workouts for delete
to authenticated
using (coach_id = auth.uid());

drop policy if exists coach_workout_exercises_select on public.workout_exercises;
create policy coach_workout_exercises_select
on public.workout_exercises for select
to authenticated
using (
  exists (
    select 1
    from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.coach_id = auth.uid()
  )
);

drop policy if exists coach_workout_exercises_insert on public.workout_exercises;
create policy coach_workout_exercises_insert
on public.workout_exercises for insert
to authenticated
with check (
  exists (
    select 1
    from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.coach_id = auth.uid()
  )
);

drop policy if exists coach_workout_exercises_update on public.workout_exercises;
create policy coach_workout_exercises_update
on public.workout_exercises for update
to authenticated
using (
  exists (
    select 1
    from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.coach_id = auth.uid()
  )
);

drop policy if exists coach_workout_exercises_delete on public.workout_exercises;
create policy coach_workout_exercises_delete
on public.workout_exercises for delete
to authenticated
using (
  exists (
    select 1
    from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.coach_id = auth.uid()
  )
);

drop policy if exists coach_workout_logs_select on public.workout_logs;
create policy coach_workout_logs_select
on public.workout_logs for select
to authenticated
using (coach_id = auth.uid());

drop policy if exists coach_workout_logs_insert on public.workout_logs;
create policy coach_workout_logs_insert
on public.workout_logs for insert
to authenticated
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.students
    where students.id = workout_logs.student_id
      and students.coach_id = auth.uid()
  )
);

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
  v_exercises jsonb := coalesce(workout_payload -> 'exercises', '[]'::jsonb);
  v_result jsonb;
begin
  if v_coach_id is null then
    raise exception using errcode = '42501', message = 'Sessao do treinador nao identificada.';
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
        notes = nullif(workout_payload ->> 'notes', ''),
        active = true
    where id = v_workout_id
      and coach_id = v_coach_id;
  else
    insert into public.workouts (coach_id, student_id, title, focus, notes, active)
    values (
      v_coach_id,
      v_student_id,
      coalesce(nullif(workout_payload ->> 'title', ''), 'Treino'),
      nullif(workout_payload ->> 'focus', ''),
      nullif(workout_payload ->> 'notes', ''),
      true
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

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;
grant select, insert on public.workout_logs to authenticated;

commit;
