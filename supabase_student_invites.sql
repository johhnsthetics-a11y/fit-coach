create table if not exists student_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  code text unique not null,
  status text default 'active',
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now()
);

alter table student_invites enable row level security;

drop policy if exists "coach can manage own student invites" on student_invites;
drop policy if exists "public can read active student invite by code" on student_invites;

create policy "coach can manage own student invites"
on student_invites for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "public can read active student invite by code"
on student_invites for select
to anon, authenticated
using (status = 'active' and expires_at > now());
