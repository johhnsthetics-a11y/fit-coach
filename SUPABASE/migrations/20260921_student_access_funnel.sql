begin;

alter table public.students
  add column if not exists billing_cycle text not null default 'mensal',
  add column if not exists first_due_date date,
  add column if not exists next_due_date date,
  add column if not exists app_subscription_started_at timestamptz,
  add column if not exists app_subscription_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_billing_cycle_check'
  ) then
    alter table public.students
      add constraint students_billing_cycle_check
      check (billing_cycle in ('semanal', 'mensal', 'semestral', 'anual'));
  end if;
end $$;

create or replace function public.coachfit_next_billing_date(p_anchor date, p_cycle text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_cycle text := lower(trim(coalesce(p_cycle, 'mensal')));
  months_to_add integer;
  target_month date;
  target_last_day integer;
begin
  if p_anchor is null then
    return null;
  end if;

  if normalized_cycle = 'semanal' then
    return p_anchor + 7;
  end if;

  months_to_add := case normalized_cycle
    when 'semestral' then 6
    when 'anual' then 12
    else 1
  end;
  target_month := (date_trunc('month', p_anchor)::date + make_interval(months => months_to_add))::date;
  target_last_day := extract(day from (target_month + interval '1 month - 1 day'))::integer;
  return make_date(
    extract(year from target_month)::integer,
    extract(month from target_month)::integer,
    least(extract(day from p_anchor)::integer, target_last_day)
  );
end;
$$;

create or replace function public.coachfit_prepare_student_billing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate date;
begin
  if new.first_due_date is not null and new.next_due_date is null then
    new.next_due_date := new.first_due_date;
  end if;

  if tg_op = 'UPDATE'
     and new.payment = 'Pago'
     and old.payment is distinct from new.payment then
    candidate := coalesce(new.next_due_date, new.first_due_date, current_date);
    while candidate <= current_date loop
      candidate := public.coachfit_next_billing_date(candidate, new.billing_cycle);
    end loop;
    new.next_due_date := candidate;
  end if;

  return new;
end;
$$;

drop trigger if exists coachfit_prepare_student_billing on public.students;
create trigger coachfit_prepare_student_billing
before insert or update
on public.students
for each row execute function public.coachfit_prepare_student_billing();

alter table public.student_invites
  alter column expires_at set default (now() + interval '365 days');

create or replace function public.create_student_checkout_session_by_invite(invite_code text)
returns table (checkout_token uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_invite public.student_invites%rowtype;
  new_session public.student_checkout_sessions%rowtype;
begin
  select invites.* into active_invite
  from public.student_invites as invites
  join public.students as students
    on students.id = invites.student_id
   and students.coach_id = invites.coach_id
  where invites.code = trim(invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado' using errcode = '42501';
  end if;

  update public.student_checkout_sessions as sessions
  set status = 'canceled', updated_at = now()
  where sessions.coach_id = active_invite.coach_id
    and sessions.student_id = active_invite.student_id
    and sessions.status = 'pending';

  insert into public.student_checkout_sessions (coach_id, student_id)
  values (active_invite.coach_id, active_invite.student_id)
  returning * into new_session;

  return query
  select new_session.checkout_token, new_session.status, new_session.expires_at;
end;
$$;

revoke all on function public.create_student_checkout_session_by_invite(text) from public;
grant execute on function public.create_student_checkout_session_by_invite(text) to anon, authenticated;

create or replace function public.coachfit_student_financial_access_by_invite(p_invite_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_invites as invites
    join public.students as students
      on students.id = invites.student_id
     and students.coach_id = invites.coach_id
    where invites.code = trim(p_invite_code)
      and invites.status = 'active'
      and (invites.expires_at is null or invites.expires_at > now())
      and (
        (
          students.payment = 'Pago'
          and (students.next_due_date is null or students.next_due_date >= current_date)
          and students.app_payment_status = 'active'
          and (students.app_subscription_expires_at is null or students.app_subscription_expires_at > now())
        )
        or students.access_override_until > now()
      )
  );
$$;

create or replace function public.get_student_portal(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  portal jsonb;
  access_open boolean;
  professional_type text;
begin
  portal := public.get_student_portal_unchecked(invite_code);
  if portal is null then
    return null;
  end if;

  select case
    when lower(coalesce(users.role, '')) like '%nutri%' then 'nutritionist'
    else 'trainer'
  end into professional_type
  from public.student_invites as invites
  join public.users as users on users.id = invites.coach_id
  where invites.code = trim(invite_code)
  order by invites.created_at desc
  limit 1;

  access_open := public.coachfit_student_financial_access_by_invite(invite_code);
  if access_open then
    return portal || jsonb_build_object(
      'financial_access_open', true,
      'professional_type', coalesce(professional_type, 'trainer')
    );
  end if;

  return portal || jsonb_build_object(
    'financial_access_open', false,
    'professional_type', coalesce(professional_type, 'trainer'),
    'checkins', '[]'::jsonb,
    'workouts', '[]'::jsonb,
    'nutrition_plans', '[]'::jsonb,
    'workout_logs', '[]'::jsonb,
    'appointments', '[]'::jsonb,
    'assessments', '[]'::jsonb
  );
end;
$$;

revoke all on function public.coachfit_next_billing_date(date, text) from public;
revoke all on function public.coachfit_prepare_student_billing() from public;
revoke all on function public.coachfit_student_financial_access_by_invite(text) from public, anon, authenticated;

commit;
