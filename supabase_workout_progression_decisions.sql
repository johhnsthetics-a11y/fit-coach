create table if not exists public.workout_progression_decisions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  exercise_name text not null,
  action text not null,
  suggestion text,
  reason text,
  confidence text,
  status text not null default 'approved',
  previous_target jsonb default '{}'::jsonb,
  next_target jsonb default '{}'::jsonb,
  source text default 'local_rules',
  created_at timestamptz default now()
);

alter table public.workout_progression_decisions enable row level security;

drop policy if exists "coach can manage own workout progression decisions" on public.workout_progression_decisions;

create policy "coach can manage own workout progression decisions"
on public.workout_progression_decisions
for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create index if not exists workout_progression_decisions_coach_created_idx
on public.workout_progression_decisions (coach_id, created_at desc);

create index if not exists workout_progression_decisions_student_idx
on public.workout_progression_decisions (student_id, created_at desc);
