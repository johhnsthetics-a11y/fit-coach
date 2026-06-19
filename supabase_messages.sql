create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  sender text not null check (sender in ('coach', 'student')),
  body text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table messages enable row level security;

drop policy if exists "coach can manage own messages" on messages;
drop policy if exists "student invite can read own messages" on messages;
drop policy if exists "student invite can create own messages" on messages;

create policy "coach can manage own messages"
on messages for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "student invite can read own messages"
on messages for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = messages.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can create own messages"
on messages for insert
to anon, authenticated
with check (
  sender = 'student'
  and exists (
    select 1
    from student_invites
    where student_invites.student_id = messages.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);
