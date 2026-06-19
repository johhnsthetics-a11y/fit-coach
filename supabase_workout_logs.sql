create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  workout_id uuid references workouts(id) on delete set null,
  title text not null,
  effort text,
  notes text,
  completed_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table workout_logs enable row level security;

drop policy if exists "coach can manage own workout logs" on workout_logs;
drop policy if exists "student invite can read own workout logs" on workout_logs;
drop policy if exists "student invite can create workout logs" on workout_logs;

create policy "coach can manage own workout logs"
on workout_logs for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "student invite can read own workout logs"
on workout_logs for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = workout_logs.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can create workout logs"
on workout_logs for insert
to anon, authenticated
with check (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = workout_logs.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);
