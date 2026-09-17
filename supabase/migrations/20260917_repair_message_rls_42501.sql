-- Coach Fit Pro
-- Repair coach message inserts that can surface PostgreSQL 42501 when the
-- client sends a stale/mismatched coach_id. Keep ownership enforced by RLS.

alter table public.messages enable row level security;

grant select, insert, update, delete on public.messages to authenticated;
revoke all on public.messages from anon;

create or replace function public.coachfit_normalize_coach_message()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_coach_id uuid := auth.uid();
begin
  if new.sender <> 'coach' then
    return new;
  end if;

  if v_coach_id is null then
    raise exception 'Sessao do treinador nao identificada.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = new.student_id
      and s.coach_id = v_coach_id
  ) then
    raise exception 'Aluno nao pertence ao treinador autenticado.' using errcode = '42501';
  end if;

  -- Never trust coach_id supplied by the browser. The authenticated session is
  -- the source of truth for coach-authored messages.
  new.coach_id := v_coach_id;
  return new;
end;
$$;

revoke all on function public.coachfit_normalize_coach_message() from public;
revoke all on function public.coachfit_normalize_coach_message() from anon;
grant execute on function public.coachfit_normalize_coach_message() to authenticated;

drop trigger if exists messages_normalize_coach_sender on public.messages;
create trigger messages_normalize_coach_sender
before insert on public.messages
for each row
when (new.sender = 'coach')
execute function public.coachfit_normalize_coach_message();

drop policy if exists "coach can manage own messages" on public.messages;
drop policy if exists messages_select_own_coach on public.messages;
drop policy if exists messages_insert_own_student on public.messages;
drop policy if exists messages_update_own_coach on public.messages;
drop policy if exists messages_delete_own_coach on public.messages;

create policy messages_select_own_coach
on public.messages
for select
to authenticated
using (coach_id = (select auth.uid()));

create policy messages_insert_own_student
on public.messages
for insert
to authenticated
with check (
  coach_id = (select auth.uid())
  and exists (
    select 1
    from public.students s
    where s.id = messages.student_id
      and s.coach_id = (select auth.uid())
  )
);

create policy messages_update_own_coach
on public.messages
for update
to authenticated
using (coach_id = (select auth.uid()))
with check (
  coach_id = (select auth.uid())
  and exists (
    select 1
    from public.students s
    where s.id = messages.student_id
      and s.coach_id = (select auth.uid())
  )
);

create policy messages_delete_own_coach
on public.messages
for delete
to authenticated
using (coach_id = (select auth.uid()));
