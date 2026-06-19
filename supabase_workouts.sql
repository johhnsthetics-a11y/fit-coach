create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  title text not null,
  focus text,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references workouts(id) on delete cascade,
  name text not null,
  sets text,
  reps text,
  load text,
  rest text,
  order_index integer default 0,
  created_at timestamptz default now()
);

alter table workouts enable row level security;
alter table workout_exercises enable row level security;

drop policy if exists "coach can manage own workouts" on workouts;
drop policy if exists "coach can manage own workout exercises" on workout_exercises;
drop policy if exists "student invite can read workouts" on workouts;
drop policy if exists "student invite can read workout exercises" on workout_exercises;

create policy "coach can manage own workouts"
on workouts for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "coach can manage own workout exercises"
on workout_exercises for all
to authenticated
using (
  exists (
    select 1
    from workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.coach_id = auth.uid()
  )
);

create policy "student invite can read workouts"
on workouts for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = workouts.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can read workout exercises"
on workout_exercises for select
to anon, authenticated
using (
  exists (
    select 1
    from workouts
    join student_invites on student_invites.student_id = workouts.student_id
    where workouts.id = workout_exercises.workout_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);
