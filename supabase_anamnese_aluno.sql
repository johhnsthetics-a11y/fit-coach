create table if not exists student_anamneses (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  invite_id uuid references student_invites(id) on delete set null,
  birth_date date,
  occupation text,
  training_experience text,
  training_frequency text,
  primary_goal text,
  injuries text,
  health_conditions text,
  medications text,
  surgeries text,
  pain text,
  sleep_hours text,
  sleep_quality text,
  stress_level text,
  water_intake text,
  food_restrictions text,
  routine text,
  observations text,
  emergency_contact text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id)
);

create index if not exists student_anamneses_coach_idx
on student_anamneses (coach_id, submitted_at desc);

alter table student_anamneses enable row level security;

drop policy if exists "coach can read own student anamneses" on student_anamneses;

create policy "coach can read own student anamneses"
on student_anamneses for select
to authenticated
using (coach_id = auth.uid());

create or replace function get_student_anamnesis(invite_code text)
returns setof student_anamneses
language sql
security definer
set search_path = public
begin atomic
  select sa.*
  from student_anamneses sa
  join student_invites si on si.student_id = sa.student_id
  where si.code = invite_code
    and si.status = 'active'
    and si.expires_at > now()
  limit 1;
end;

create or replace function submit_student_anamnesis(
  invite_code text,
  birth_date_value date,
  occupation_value text,
  training_experience_value text,
  training_frequency_value text,
  primary_goal_value text,
  injuries_value text,
  health_conditions_value text,
  medications_value text,
  surgeries_value text,
  pain_value text,
  sleep_hours_value text,
  sleep_quality_value text,
  stress_level_value text,
  water_intake_value text,
  food_restrictions_value text,
  routine_value text,
  observations_value text,
  emergency_contact_value text
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
      coach_id,
      student_id,
      invite_id,
      birth_date,
      occupation,
      training_experience,
      training_frequency,
      primary_goal,
      injuries,
      health_conditions,
      medications,
      surgeries,
      pain,
      sleep_hours,
      sleep_quality,
      stress_level,
      water_intake,
      food_restrictions,
      routine,
      observations,
      emergency_contact,
      submitted_at,
      updated_at
    )
    select
      ai.coach_id,
      ai.student_id,
      ai.id,
      birth_date_value,
      occupation_value,
      training_experience_value,
      training_frequency_value,
      primary_goal_value,
      injuries_value,
      health_conditions_value,
      medications_value,
      surgeries_value,
      pain_value,
      sleep_hours_value,
      sleep_quality_value,
      stress_level_value,
      water_intake_value,
      food_restrictions_value,
      routine_value,
      observations_value,
      emergency_contact_value,
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

grant execute on function get_student_anamnesis(text) to anon, authenticated;
grant execute on function submit_student_anamnesis(
  text, date, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) to anon, authenticated;
