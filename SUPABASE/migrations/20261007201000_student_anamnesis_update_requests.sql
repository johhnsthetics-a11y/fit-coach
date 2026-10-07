begin;

alter table public.student_anamneses
  add column if not exists student_update_requested_at timestamptz;

create or replace function public.save_professional_student_anamnesis(
  p_student_id uuid,
  p_answers jsonb
)
returns setof public.student_anamneses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_id uuid := (select auth.uid());
  v_student_coach_id uuid;
  v_height_text text := nullif(trim(coalesce(p_answers->>'heightCm', '')), '');
  v_weight_text text := nullif(trim(coalesce(p_answers->>'weightKg', '')), '');
  v_request_update boolean := coalesce((p_answers->>'requestStudentUpdate')::boolean, false);
begin
  if v_coach_id is null then
    raise exception 'Sessão profissional obrigatória' using errcode = '42501';
  end if;

  if p_student_id is null or jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Anamnese inválida' using errcode = '22023';
  end if;

  select students.coach_id
    into v_student_coach_id
  from public.students as students
  where students.id = p_student_id;

  if v_student_coach_id is distinct from v_coach_id then
    raise exception 'Aluno não encontrado ou sem vínculo com este profissional' using errcode = '42501';
  end if;

  return query
  insert into public.student_anamneses as existing (
    coach_id, student_id, birth_date, biological_sex, height_cm, weight_kg,
    activity_level, occupation, training_experience, training_frequency,
    primary_goal, injuries, health_conditions, medications, surgeries, pain,
    sleep_hours, sleep_quality, stress_level, water_intake, food_restrictions,
    routine, observations, emergency_contact, answers, source, authored_by,
    submitted_at, updated_at, student_update_requested_at
  ) values (
    v_coach_id,
    p_student_id,
    nullif(trim(coalesce(p_answers->>'birthDate', '')), '')::date,
    nullif(trim(coalesce(p_answers->>'biologicalSex', '')), ''),
    case when v_height_text ~ '^[0-9]+([.,][0-9]+)?$' then replace(v_height_text, ',', '.')::numeric else null end,
    case when v_weight_text ~ '^[0-9]+([.,][0-9]+)?$' then replace(v_weight_text, ',', '.')::numeric else null end,
    nullif(trim(coalesce(p_answers->>'activityLevel', '')), ''),
    nullif(trim(coalesce(p_answers->>'occupation', '')), ''),
    nullif(trim(coalesce(p_answers->>'trainingExperience', '')), ''),
    nullif(trim(coalesce(p_answers->>'trainingFrequency', '')), ''),
    nullif(trim(coalesce(p_answers->>'primaryGoal', '')), ''),
    nullif(trim(coalesce(p_answers->>'injuries', '')), ''),
    nullif(trim(coalesce(p_answers->>'healthConditions', '')), ''),
    nullif(trim(coalesce(p_answers->>'medications', '')), ''),
    nullif(trim(coalesce(p_answers->>'surgeries', '')), ''),
    nullif(trim(coalesce(p_answers->>'pain', '')), ''),
    nullif(trim(coalesce(p_answers->>'sleepHours', '')), ''),
    nullif(trim(coalesce(p_answers->>'sleepQuality', '')), ''),
    nullif(trim(coalesce(p_answers->>'stressLevel', '')), ''),
    nullif(trim(coalesce(p_answers->>'waterIntake', '')), ''),
    nullif(trim(coalesce(p_answers->>'foodRestrictions', '')), ''),
    nullif(trim(coalesce(p_answers->>'routine', '')), ''),
    nullif(trim(coalesce(p_answers->>'observations', '')), ''),
    nullif(trim(coalesce(p_answers->>'emergencyContact', '')), ''),
    p_answers - 'requestStudentUpdate',
    'professional',
    v_coach_id,
    now(),
    now(),
    case when v_request_update then now() else null end
  )
  on conflict (student_id) do update set
    coach_id = excluded.coach_id,
    birth_date = excluded.birth_date,
    biological_sex = excluded.biological_sex,
    height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg,
    activity_level = excluded.activity_level,
    occupation = excluded.occupation,
    training_experience = excluded.training_experience,
    training_frequency = excluded.training_frequency,
    primary_goal = excluded.primary_goal,
    injuries = excluded.injuries,
    health_conditions = excluded.health_conditions,
    medications = excluded.medications,
    surgeries = excluded.surgeries,
    pain = excluded.pain,
    sleep_hours = excluded.sleep_hours,
    sleep_quality = excluded.sleep_quality,
    stress_level = excluded.stress_level,
    water_intake = excluded.water_intake,
    food_restrictions = excluded.food_restrictions,
    routine = excluded.routine,
    observations = excluded.observations,
    emergency_contact = excluded.emergency_contact,
    answers = excluded.answers,
    source = excluded.source,
    authored_by = excluded.authored_by,
    submitted_at = excluded.submitted_at,
    updated_at = excluded.updated_at,
    student_update_requested_at = case
      when v_request_update then now()
      else existing.student_update_requested_at
    end
  returning *;
end;
$$;

create or replace function public.submit_student_anamnesis(
  invite_code text,
  answers jsonb
)
returns setof public.student_anamneses
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(answers) is distinct from 'object' then
    raise exception 'Anamnese inválida' using errcode = '22023';
  end if;

  return query
  with active_invite as (
    select invites.*
    from public.student_invites as invites
    join public.students as students
      on students.id = invites.student_id
     and students.coach_id = invites.coach_id
    where invites.code = trim(invite_code)
      and invites.status = 'active'
      and invites.expires_at > now()
    order by invites.created_at desc
    limit 1
  ),
  saved as (
    insert into public.student_anamneses (
      coach_id, student_id, invite_id, birth_date, biological_sex, height_cm,
      weight_kg, activity_level, occupation, training_experience,
      training_frequency, primary_goal, injuries, health_conditions,
      medications, surgeries, pain, sleep_hours, sleep_quality, stress_level,
      water_intake, food_restrictions, routine, observations, emergency_contact,
      answers, source, authored_by, submitted_at, updated_at,
      student_update_requested_at
    )
    select
      active_invite.coach_id,
      active_invite.student_id,
      active_invite.id,
      nullif(trim(coalesce(answers->>'birthDate', '')), '')::date,
      nullif(trim(coalesce(answers->>'biologicalSex', '')), ''),
      case when nullif(trim(coalesce(answers->>'heightCm', '')), '') ~ '^[0-9]+([.,][0-9]+)?$'
        then replace(trim(answers->>'heightCm'), ',', '.')::numeric else null end,
      case when nullif(trim(coalesce(answers->>'weightKg', '')), '') ~ '^[0-9]+([.,][0-9]+)?$'
        then replace(trim(answers->>'weightKg'), ',', '.')::numeric else null end,
      nullif(trim(coalesce(answers->>'activityLevel', '')), ''),
      nullif(trim(coalesce(answers->>'occupation', '')), ''),
      nullif(trim(coalesce(answers->>'trainingExperience', '')), ''),
      nullif(trim(coalesce(answers->>'trainingFrequency', '')), ''),
      nullif(trim(coalesce(answers->>'primaryGoal', '')), ''),
      nullif(trim(coalesce(answers->>'injuries', '')), ''),
      nullif(trim(coalesce(answers->>'healthConditions', '')), ''),
      nullif(trim(coalesce(answers->>'medications', '')), ''),
      nullif(trim(coalesce(answers->>'surgeries', '')), ''),
      nullif(trim(coalesce(answers->>'pain', '')), ''),
      nullif(trim(coalesce(answers->>'sleepHours', '')), ''),
      nullif(trim(coalesce(answers->>'sleepQuality', '')), ''),
      nullif(trim(coalesce(answers->>'stressLevel', '')), ''),
      nullif(trim(coalesce(answers->>'waterIntake', '')), ''),
      nullif(trim(coalesce(answers->>'foodRestrictions', '')), ''),
      nullif(trim(coalesce(answers->>'routine', '')), ''),
      nullif(trim(coalesce(answers->>'observations', '')), ''),
      nullif(trim(coalesce(answers->>'emergencyContact', '')), ''),
      answers,
      'student',
      null,
      now(),
      now(),
      null
    from active_invite
    on conflict (student_id) do update set
      coach_id = excluded.coach_id,
      invite_id = excluded.invite_id,
      birth_date = excluded.birth_date,
      biological_sex = excluded.biological_sex,
      height_cm = excluded.height_cm,
      weight_kg = excluded.weight_kg,
      activity_level = excluded.activity_level,
      occupation = excluded.occupation,
      training_experience = excluded.training_experience,
      training_frequency = excluded.training_frequency,
      primary_goal = excluded.primary_goal,
      injuries = excluded.injuries,
      health_conditions = excluded.health_conditions,
      medications = excluded.medications,
      surgeries = excluded.surgeries,
      pain = excluded.pain,
      sleep_hours = excluded.sleep_hours,
      sleep_quality = excluded.sleep_quality,
      stress_level = excluded.stress_level,
      water_intake = excluded.water_intake,
      food_restrictions = excluded.food_restrictions,
      routine = excluded.routine,
      observations = excluded.observations,
      emergency_contact = excluded.emergency_contact,
      answers = excluded.answers,
      source = excluded.source,
      authored_by = excluded.authored_by,
      submitted_at = excluded.submitted_at,
      updated_at = excluded.updated_at,
      student_update_requested_at = null
    returning *
  ),
  notification_created as (
    insert into public.notifications (user_id, title, body, read)
    select
      saved.coach_id,
      'Anamnese enviada para revisão',
      coalesce(students.name, 'O aluno') || ' enviou uma anamnese para revisão.',
      false
    from public.students as students
    join saved on saved.student_id = students.id
    returning id
  )
  select * from saved;
end;
$$;

revoke all on function public.submit_student_anamnesis(text, jsonb) from public;
grant execute on function public.submit_student_anamnesis(text, jsonb) to anon, authenticated;
revoke all on function public.save_professional_student_anamnesis(uuid, jsonb) from public, anon;
grant execute on function public.save_professional_student_anamnesis(uuid, jsonb) to authenticated;

commit;
