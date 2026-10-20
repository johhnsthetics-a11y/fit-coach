begin;

create or replace function public.validate_workout_execution(p_workout_id uuid, p_execution jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notes text;
  v_line text;
  v_days jsonb;
  v_day jsonb;
  v_exercise jsonb;
  v_cardio_log jsonb;
  v_day_index integer := 0;
  v_exercise_index integer := 0;
  v_set integer;
  v_count integer;
  v_total integer := 0;
  v_is_cardio boolean;
begin
  if p_execution is null or jsonb_typeof(p_execution) <> 'object' then
    raise exception using errcode = '22023', message = 'Progresso de treino invalido.';
  end if;

  if coalesce(p_execution ->> 'activeDayIndex', '0') !~ '^\d+$' then
    raise exception using errcode = '22023', message = 'Dia de treino invalido.';
  end if;
  v_day_index := (coalesce(p_execution ->> 'activeDayIndex', '0'))::integer;

  select workouts.notes
  into v_notes
  from public.workouts
  where workouts.id = p_workout_id;

  for v_line in select unnest(string_to_array(coalesce(v_notes, ''), E'\n')) loop
    if starts_with(trim(v_line), '[coachfitpro-workout-meta]') then
      begin
        v_days := (substr(trim(v_line), length('[coachfitpro-workout-meta]') + 1)::jsonb) -> 'days';
      exception when others then
        v_days := null;
      end;
    end if;
  end loop;

  if v_days is null or jsonb_typeof(v_days) <> 'array' or jsonb_array_length(v_days) = 0 then
    select jsonb_build_array(
      jsonb_build_object(
        'exercises', coalesce(jsonb_agg(to_jsonb(exercise) order by exercise.order_index), '[]'::jsonb)
      )
    )
    into v_days
    from public.workout_exercises as exercise
    where exercise.workout_id = p_workout_id;
  end if;

  if v_day_index < 0 or v_day_index >= jsonb_array_length(v_days) then
    raise exception using errcode = '22023', message = 'Dia de treino invalido.';
  end if;

  v_day := v_days -> v_day_index;
  for v_exercise in
    select value from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb))
  loop
    v_is_cardio := lower(coalesce(v_exercise ->> 'exerciseType', '')) = 'cardio'
      or nullif(v_exercise ->> 'cardioMode', '') is not null;

    if v_is_cardio then
      v_cardio_log := coalesce(
        p_execution -> 'cardioLogs' -> (v_day_index::text || '-' || v_exercise_index::text),
        '{}'::jsonb
      );
      if lower(coalesce(v_cardio_log ->> 'status', '')) <> 'completed'
        and coalesce(v_cardio_log ->> 'completed', 'false') <> 'true' then
        raise exception using errcode = '22023', message = 'Finalize a atividade cardiovascular antes de concluir.';
      end if;
      v_total := v_total + 1;
    else
      v_count := greatest(1, coalesce(nullif(substring(v_exercise ->> 'sets' from '^[0-9]+'), '')::integer, 1));
      if v_count > 100 then
        raise exception using errcode = '22023', message = 'Quantidade de series invalida.';
      end if;
      for v_set in 1..v_count loop
        if p_execution -> 'setLogs' -> (v_day_index::text || '-' || v_exercise_index::text || '-' || v_set::text) -> 'completed'
          is distinct from 'true'::jsonb then
          raise exception using errcode = '22023', message = 'Conclua todas as series antes de finalizar.';
        end if;
        v_total := v_total + 1;
      end loop;
    end if;
    v_exercise_index := v_exercise_index + 1;
  end loop;

  if v_total = 0 then
    raise exception using errcode = '22023', message = 'O treino nao possui exercicios.';
  end if;
end;
$$;

revoke all on function public.validate_workout_execution(uuid, jsonb) from public, anon, authenticated;

commit;
