begin;

create table if not exists public.student_free_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  beneficiary_type text not null default 'student',
  reason text not null default '',
  active boolean not null default true,
  created_by uuid,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_by_email text,
  constraint student_free_access_grants_email_normalized_check
    check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint student_free_access_grants_beneficiary_type_check
    check (beneficiary_type in ('student', 'patient')),
  constraint student_free_access_grants_reason_length_check
    check (char_length(reason) <= 500)
);

comment on table public.student_free_access_grants is
  'Liberações manuais e auditáveis de acesso integral para contas de teste de alunos e pacientes.';

create index if not exists student_free_access_grants_active_updated_idx
  on public.student_free_access_grants (active, updated_at desc);

alter table public.student_free_access_grants enable row level security;
revoke all on table public.student_free_access_grants from public, anon, authenticated;

create or replace function public.coachfit_student_has_free_access(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_free_access_grants as grants
    where grants.email = lower(btrim(coalesce(p_email, '')))
      and grants.active = true
  );
$$;

revoke all on function public.coachfit_student_has_free_access(text) from public, anon, authenticated;

create or replace function public.coachfit_list_student_free_access_grants()
returns table (
  id uuid,
  email text,
  beneficiary_type text,
  reason text,
  active boolean,
  created_by_email text,
  created_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz,
  revoked_by_email text,
  matched_profiles bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or lower(btrim(coalesce(auth.jwt() ->> 'email', ''))) <> 'sac@coachfitpro.com.br' then
    raise exception 'Acesso exclusivo do Admin Master.' using errcode = '42501';
  end if;

  return query
  select
    grants.id,
    grants.email,
    grants.beneficiary_type,
    grants.reason,
    grants.active,
    grants.created_by_email,
    grants.created_at,
    grants.updated_at,
    grants.revoked_at,
    grants.revoked_by_email,
    (
      select count(*)
      from public.students as students
      where lower(btrim(coalesce(students.email, ''))) = grants.email
    ) as matched_profiles
  from public.student_free_access_grants as grants
  order by grants.active desc, grants.updated_at desc, grants.email;
end;
$$;

revoke all on function public.coachfit_list_student_free_access_grants() from public, anon, authenticated;
grant execute on function public.coachfit_list_student_free_access_grants() to authenticated;

create or replace function public.coachfit_grant_student_free_access(
  p_email text,
  p_beneficiary_type text default 'student',
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  normalized_type text := lower(btrim(coalesce(p_beneficiary_type, '')));
  normalized_reason text := btrim(coalesce(p_reason, ''));
  admin_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  saved public.student_free_access_grants%rowtype;
begin
  if auth.uid() is null or admin_email <> 'sac@coachfitpro.com.br' then
    raise exception 'Acesso exclusivo do Admin Master.' using errcode = '42501';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido de aluno ou paciente.' using errcode = '22023';
  end if;

  if normalized_type not in ('student', 'patient') then
    raise exception 'Selecione Aluno ou Paciente.' using errcode = '22023';
  end if;

  if char_length(normalized_reason) > 500 then
    raise exception 'O motivo deve ter no máximo 500 caracteres.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.users as users
    where lower(btrim(coalesce(users.email, ''))) = normalized_email
  ) then
    raise exception 'Use apenas o e-mail de um aluno ou paciente, não de um profissional.' using errcode = '22023';
  end if;

  insert into public.student_free_access_grants (
    email,
    beneficiary_type,
    reason,
    active,
    created_by,
    created_by_email,
    revoked_at,
    revoked_by,
    revoked_by_email
  ) values (
    normalized_email,
    normalized_type,
    normalized_reason,
    true,
    auth.uid(),
    admin_email,
    null,
    null,
    null
  )
  on conflict (email) do update
  set beneficiary_type = excluded.beneficiary_type,
      reason = excluded.reason,
      active = true,
      created_by = excluded.created_by,
      created_by_email = excluded.created_by_email,
      updated_at = now(),
      revoked_at = null,
      revoked_by = null,
      revoked_by_email = null
  returning * into saved;

  return jsonb_build_object(
    'id', saved.id,
    'email', saved.email,
    'beneficiaryType', saved.beneficiary_type,
    'reason', saved.reason,
    'active', saved.active,
    'createdByEmail', saved.created_by_email,
    'createdAt', saved.created_at,
    'updatedAt', saved.updated_at,
    'revokedAt', saved.revoked_at
  );
end;
$$;

revoke all on function public.coachfit_grant_student_free_access(text, text, text) from public, anon, authenticated;
grant execute on function public.coachfit_grant_student_free_access(text, text, text) to authenticated;

create or replace function public.coachfit_revoke_student_free_access(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  admin_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  saved public.student_free_access_grants%rowtype;
begin
  if auth.uid() is null or admin_email <> 'sac@coachfitpro.com.br' then
    raise exception 'Acesso exclusivo do Admin Master.' using errcode = '42501';
  end if;

  update public.student_free_access_grants as grants
  set active = false,
      updated_at = now(),
      revoked_at = now(),
      revoked_by = auth.uid(),
      revoked_by_email = admin_email
  where grants.email = normalized_email
    and grants.active = true
  returning grants.* into saved;

  if saved.id is null then
    raise exception 'Liberação ativa não encontrada para este e-mail.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', saved.id,
    'email', saved.email,
    'beneficiaryType', saved.beneficiary_type,
    'reason', saved.reason,
    'active', saved.active,
    'createdByEmail', saved.created_by_email,
    'createdAt', saved.created_at,
    'updatedAt', saved.updated_at,
    'revokedAt', saved.revoked_at,
    'revokedByEmail', saved.revoked_by_email
  );
end;
$$;

revoke all on function public.coachfit_revoke_student_free_access(text) from public, anon, authenticated;
grant execute on function public.coachfit_revoke_student_free_access(text) to authenticated;

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
        public.coachfit_student_has_free_access(students.email)
        or (
          students.payment = 'Pago'
          and (students.next_due_date is null or students.next_due_date >= current_date)
          and (
            not public.coachfit_professional_requires_app_payment(invites.coach_id)
            or (
              students.app_payment_status = 'active'
              and (students.app_subscription_expires_at is null or students.app_subscription_expires_at > now())
            )
          )
        )
        or students.access_override_until > now()
      )
  );
$$;

revoke all on function public.coachfit_student_financial_access_by_invite(text) from public, anon, authenticated;

create or replace function public.create_student_checkout_session(target_student_id uuid)
returns table (checkout_token uuid, student_id uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_session public.student_checkout_sessions%rowtype;
  student_email text;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada' using errcode = '42501';
  end if;

  select students.email into student_email
  from public.students as students
  where students.id = target_student_id
    and students.coach_id = auth.uid();

  if student_email is null then
    raise exception 'Aluno nao pertence ao profissional autenticado' using errcode = '42501';
  end if;

  if public.coachfit_student_has_free_access(student_email) then
    raise exception 'Acesso gratuito já liberado pelo Admin Master; nenhuma cobrança é necessária.' using errcode = '42501';
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

create or replace function public.create_student_checkout_session_by_invite(invite_code text)
returns table (checkout_token uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_invite public.student_invites%rowtype;
  new_session public.student_checkout_sessions%rowtype;
  student_email text;
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

  select students.email into student_email
  from public.students as students
  where students.id = active_invite.student_id
    and students.coach_id = active_invite.coach_id;

  if public.coachfit_student_has_free_access(student_email) then
    raise exception 'Acesso gratuito já liberado pelo Admin Master; nenhuma cobrança é necessária.' using errcode = '42501';
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
  student_email text;
  free_access_granted boolean := false;
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
    nullif(btrim(users.name), ''),
    students.email
  into professional_id, professional_type, professional_name, student_email
  from public.student_invites as invites
  join public.students as students
    on students.id = invites.student_id
   and students.coach_id = invites.coach_id
  join public.users as users on users.id = invites.coach_id
  where invites.code = trim(invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  free_access_granted := public.coachfit_student_has_free_access(student_email);
  app_payment_required := case
    when free_access_granted then false
    else coalesce(public.coachfit_professional_requires_app_payment(professional_id), false)
  end;
  access_open := public.coachfit_student_financial_access_by_invite(invite_code);

  if access_open then
    return portal || jsonb_build_object(
      'financial_access_open', true,
      'free_access_granted', free_access_granted,
      'app_payment_required', app_payment_required,
      'professional_type', coalesce(professional_type, 'trainer'),
      'professional_name', coalesce(professional_name, '')
    );
  end if;

  return portal || jsonb_build_object(
    'financial_access_open', false,
    'free_access_granted', false,
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
