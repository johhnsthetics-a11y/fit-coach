create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  title text not null,
  appointment_type text not null default 'Consulta',
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  status text not null default 'Agendado' check (status in ('Agendado', 'Confirmado', 'Concluido', 'Cancelado')),
  location text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists appointments_coach_starts_at_idx
on appointments (coach_id, starts_at);

alter table appointments enable row level security;

drop policy if exists "coach can manage own appointments" on appointments;
drop policy if exists "student invite can read own appointments" on appointments;

create policy "coach can manage own appointments"
on appointments for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "student invite can read own appointments"
on appointments for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = appointments.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);
