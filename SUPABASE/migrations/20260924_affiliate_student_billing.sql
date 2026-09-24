begin;

create table if not exists public.affiliate_professionals (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_professionals_email_normalized
    check (
      email = lower(btrim(email))
      and position('@' in email) > 1
    )
);

comment on table public.affiliate_professionals is
  'Profissionais cujos alunos/pacientes devem pagar a assinatura do app via Cartpanda. O vinculo e feito pelo e-mail do profissional.';

alter table public.affiliate_professionals enable row level security;

revoke all on table public.affiliate_professionals from public, anon, authenticated;
grant select, insert, update, delete on table public.affiliate_professionals to authenticated;

drop policy if exists "affiliate_professionals_master_select" on public.affiliate_professionals;
create policy "affiliate_professionals_master_select"
on public.affiliate_professionals
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
);

drop policy if exists "affiliate_professionals_master_insert" on public.affiliate_professionals;
create policy "affiliate_professionals_master_insert"
on public.affiliate_professionals
for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
);

drop policy if exists "affiliate_professionals_master_update" on public.affiliate_professionals;
create policy "affiliate_professionals_master_update"
on public.affiliate_professionals
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
);

drop policy if exists "affiliate_professionals_master_delete" on public.affiliate_professionals;
create policy "affiliate_professionals_master_delete"
on public.affiliate_professionals
for delete
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
);

create or replace function public.coachfit_professional_requires_app_payment(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users as users
    join public.affiliate_professionals as affiliates
      on affiliates.email = lower(btrim(users.email))
     and affiliates.active = true
    where users.id = p_coach_id
  );
$$;

revoke all on function public.coachfit_professional_requires_app_payment(uuid) from public, anon, authenticated;

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
        not public.coachfit_professional_requires_app_payment(invites.coach_id)
        or (
          (
            students.payment = 'Pago'
            and (students.next_due_date is null or students.next_due_date >= current_date)
            and students.app_payment_status = 'active'
            and (students.app_subscription_expires_at is null or students.app_subscription_expires_at > now())
          )
          or students.access_override_until > now()
        )
      )
  );
$$;

revoke all on function public.coachfit_student_financial_access_by_invite(text) from public, anon, authenticated;

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

  if not public.coachfit_professional_requires_app_payment(active_invite.coach_id) then
    raise exception 'Este profissional nao exige pagamento do aplicativo.' using errcode = '42501';
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

create or replace function public.get_student_portal(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  portal jsonb;
  access_open boolean;
  professional_id uuid;
  professional_type text;
  professional_name text;
  app_payment_required boolean := false;
begin
  portal := public.get_student_portal_unchecked(invite_code);
  if portal is null then
    return null;
  end if;

  select
    invites.coach_id,
    case
      when lower(coalesce(users.role, '')) like '%nutri%' then 'nutritionist'
      else 'trainer'
    end,
    nullif(btrim(users.name), '')
  into professional_id, professional_type, professional_name
  from public.student_invites as invites
  join public.users as users on users.id = invites.coach_id
  where invites.code = trim(invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  app_payment_required := coalesce(
    public.coachfit_professional_requires_app_payment(professional_id),
    false
  );
  access_open := public.coachfit_student_financial_access_by_invite(invite_code);

  if access_open then
    return portal || jsonb_build_object(
      'financial_access_open', true,
      'app_payment_required', app_payment_required,
      'professional_type', coalesce(professional_type, 'trainer'),
      'professional_name', coalesce(professional_name, '')
    );
  end if;

  return portal || jsonb_build_object(
    'financial_access_open', false,
    'app_payment_required', app_payment_required,
    'professional_type', coalesce(professional_type, 'trainer'),
    'professional_name', coalesce(professional_name, ''),
    'checkins', '[]'::jsonb,
    'workouts', '[]'::jsonb,
    'nutrition_plans', '[]'::jsonb,
    'workout_logs', '[]'::jsonb,
    'appointments', '[]'::jsonb,
    'assessments', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_student_portal(text) from public;
grant execute on function public.get_student_portal(text) to anon, authenticated;

commit;
