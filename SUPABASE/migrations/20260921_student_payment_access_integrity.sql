alter table public.students
  add column if not exists app_payment_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_app_payment_status_check'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_app_payment_status_check
      check (app_payment_status in ('pending', 'active', 'past_due', 'canceled', 'refunded', 'chargeback'));
  end if;
end;
$$;

comment on column public.students.app_payment_status is
  'Status da assinatura Cartpanda do aluno/paciente, separado da mensalidade cobrada pelo profissional.';

update public.students as students
set app_payment_status = 'active',
    updated_at = now()
where exists (
  select 1
  from public.student_checkout_sessions as checkout_sessions
  where checkout_sessions.student_id = students.id
    and checkout_sessions.coach_id = students.coach_id
    and checkout_sessions.status = 'active'
);

create or replace function public.create_student_checkout_session(target_student_id uuid)
returns table (checkout_token uuid, student_id uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_session public.student_checkout_sessions;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.students as students
    where students.id = target_student_id
      and students.coach_id = auth.uid()
  ) then
    raise exception 'Aluno nao pertence ao profissional autenticado' using errcode = '42501';
  end if;

  update public.student_checkout_sessions as checkout_sessions
  set status = 'canceled', updated_at = now()
  where checkout_sessions.coach_id = auth.uid()
    and checkout_sessions.student_id = target_student_id
    and checkout_sessions.status = 'pending';

  insert into public.student_checkout_sessions (coach_id, student_id)
  values (auth.uid(), target_student_id)
  returning * into new_session;

  return query
  select new_session.checkout_token, new_session.student_id, new_session.status, new_session.expires_at;
end;
$$;

revoke all on function public.create_student_checkout_session(uuid) from public, anon;
grant execute on function public.create_student_checkout_session(uuid) to authenticated;
