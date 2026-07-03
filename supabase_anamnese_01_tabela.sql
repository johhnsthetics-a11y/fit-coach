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
