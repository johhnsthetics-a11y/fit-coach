create table if not exists public.coach_protocol_tasks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  title text not null check (length(btrim(title)) > 0),
  category text not null check (category in ('training', 'nutrition', 'follow_up', 'general')),
  planned_date date not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_protocol_tasks_coach_date_idx
  on public.coach_protocol_tasks (coach_id, planned_date);

create index if not exists coach_protocol_tasks_coach_student_date_idx
  on public.coach_protocol_tasks (coach_id, student_id, planned_date);

alter table public.coach_protocol_tasks enable row level security;

revoke all on table public.coach_protocol_tasks from public, anon;
grant select, insert, update, delete on table public.coach_protocol_tasks to authenticated;

drop policy if exists "Coaches can read their protocol tasks" on public.coach_protocol_tasks;
create policy "Coaches can read their protocol tasks"
  on public.coach_protocol_tasks
  for select
  to authenticated
  using ((select auth.uid()) = coach_id);

drop policy if exists "Coaches can create their protocol tasks" on public.coach_protocol_tasks;
create policy "Coaches can create their protocol tasks"
  on public.coach_protocol_tasks
  for insert
  to authenticated
  with check (
    (select auth.uid()) = coach_id
    and (
      student_id is null
      or exists (
        select 1
        from public.students
        where students.id = coach_protocol_tasks.student_id
          and students.coach_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Coaches can update their protocol tasks" on public.coach_protocol_tasks;
create policy "Coaches can update their protocol tasks"
  on public.coach_protocol_tasks
  for update
  to authenticated
  using ((select auth.uid()) = coach_id)
  with check (
    (select auth.uid()) = coach_id
    and (
      student_id is null
      or exists (
        select 1
        from public.students
        where students.id = coach_protocol_tasks.student_id
          and students.coach_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Coaches can delete their protocol tasks" on public.coach_protocol_tasks;
create policy "Coaches can delete their protocol tasks"
  on public.coach_protocol_tasks
  for delete
  to authenticated
  using ((select auth.uid()) = coach_id);
