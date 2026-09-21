create table if not exists public.student_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  checkout_token uuid not null unique default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  provider text not null default 'cartpanda',
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'canceled', 'refunded', 'chargeback')),
  buyer_email text,
  provider_order_id text,
  provider_subscription_id text,
  amount_cents integer,
  paid_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_checkout_sessions_coach_idx
  on public.student_checkout_sessions (coach_id, created_at desc);
create index if not exists student_checkout_sessions_student_idx
  on public.student_checkout_sessions (student_id, created_at desc);

alter table public.student_checkout_sessions enable row level security;

drop policy if exists "student checkout sessions coach select" on public.student_checkout_sessions;
create policy "student checkout sessions coach select"
on public.student_checkout_sessions
for select
to authenticated
using (coach_id = auth.uid());

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

  update public.student_checkout_sessions
  set status = 'canceled', updated_at = now()
  where coach_id = auth.uid()
    and student_checkout_sessions.student_id = target_student_id
    and status = 'pending';

  insert into public.student_checkout_sessions (coach_id, student_id)
  values (auth.uid(), target_student_id)
  returning * into new_session;

  return query
  select new_session.checkout_token, new_session.student_id, new_session.status, new_session.expires_at;
end;
$$;

revoke all on function public.create_student_checkout_session(uuid) from public, anon;
grant execute on function public.create_student_checkout_session(uuid) to authenticated;
