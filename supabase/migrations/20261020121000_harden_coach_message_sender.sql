begin;

alter table public.messages enable row level security;

drop policy if exists messages_insert_own_student on public.messages;
drop policy if exists messages_update_own_coach on public.messages;
drop policy if exists messages_delete_own_coach on public.messages;

create policy messages_insert_own_student
on public.messages
for insert
to authenticated
with check (
  sender = 'coach'
  and coach_id = (select auth.uid())
  and exists (
    select 1
    from public.students as student
    where student.id = messages.student_id
      and student.coach_id = (select auth.uid())
  )
);

create policy messages_update_own_coach
on public.messages
for update
to authenticated
using (
  sender = 'coach'
  and coach_id = (select auth.uid())
)
with check (
  sender = 'coach'
  and coach_id = (select auth.uid())
  and exists (
    select 1
    from public.students as student
    where student.id = messages.student_id
      and student.coach_id = (select auth.uid())
  )
);

create policy messages_delete_own_coach
on public.messages
for delete
to authenticated
using (
  sender = 'coach'
  and coach_id = (select auth.uid())
);

commit;
