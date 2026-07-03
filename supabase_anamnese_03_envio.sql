create or replace function submit_student_anamnesis(
  invite_code text,
  answers jsonb
)
returns setof student_anamneses
language sql
security definer
set search_path = public
begin atomic
  with active_invite as (
    select si.*
    from student_invites si
    where si.code = invite_code
      and si.status = 'active'
      and si.expires_at > now()
    limit 1
  ),
  saved as (
    insert into student_anamneses (
      coach_id, student_id, invite_id, birth_date, occupation,
      training_experience, training_frequency, primary_goal, injuries,
      health_conditions, medications, surgeries, pain, sleep_hours,
      sleep_quality, stress_level, water_intake, food_restrictions,
      routine, observations, emergency_contact, submitted_at, updated_at
    )
    select
      ai.coach_id,
      ai.student_id,
      ai.id,
      nullif(answers->>'birthDate', '')::date,
      answers->>'occupation',
      answers->>'trainingExperience',
      answers->>'trainingFrequency',
      answers->>'primaryGoal',
      answers->>'injuries',
      answers->>'healthConditions',
      answers->>'medications',
      answers->>'surgeries',
      answers->>'pain',
      answers->>'sleepHours',
      answers->>'sleepQuality',
      answers->>'stressLevel',
      answers->>'waterIntake',
      answers->>'foodRestrictions',
      answers->>'routine',
      answers->>'observations',
      answers->>'emergencyContact',
      now(),
      now()
    from active_invite ai
    on conflict (student_id) do update set
      invite_id = excluded.invite_id,
      birth_date = excluded.birth_date,
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
      updated_at = now()
    returning *
  ),
  notification_created as (
    insert into notifications (user_id, title, body, read)
    select
      s.coach_id,
      'Nova anamnese recebida',
      s.name || ' concluiu a anamnese inicial.',
      false
    from students s
    join saved sa on sa.student_id = s.id
    returning id
  )
  select * from saved;
end;

grant execute on function submit_student_anamnesis(text, jsonb)
to anon, authenticated;
