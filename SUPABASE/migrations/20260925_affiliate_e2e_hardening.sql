begin;

-- Centraliza os termos vigentes do programa de afiliados sem alterar os valores atuais.
update public.app_admin_settings
set settings = jsonb_set(
  settings,
  '{affiliateProgram}',
  coalesce(settings->'affiliateProgram', jsonb_build_object(
    'monthlyFeeCents', 2500,
    'commissionRate', 0.25
  )),
  true
),
updated_at = now()
where key = 'global';

create or replace function public.coachfit_affiliate_program_terms()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'monthlyFeeCents',
      coalesce(
        nullif((settings->'affiliateProgram'->>'monthlyFeeCents')::integer, 0),
        2500
      ),
    'commissionRate',
      coalesce(
        (settings->'affiliateProgram'->>'commissionRate')::numeric,
        0.25
      )
  )
  from public.app_admin_settings
  where key = 'global'
  limit 1;
$$;

revoke all on function public.coachfit_affiliate_program_terms() from public, anon, authenticated;

-- Auditoria e ordenação dos eventos externos.
alter table public.payment_webhook_events
  add column if not exists provider_event_at timestamptz,
  add column if not exists processed_at timestamptz;

alter table public.student_checkout_sessions
  add column if not exists last_provider_event_at timestamptz,
  add column if not exists last_webhook_event_id text;

create index if not exists student_checkout_sessions_last_provider_event_idx
  on public.student_checkout_sessions(last_provider_event_at);

-- A assinatura de R$25 do app é independente da mensalidade que o profissional
-- cobra do próprio aluno/paciente. A fonte de verdade é o status Cartpanda do app.
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
            students.app_payment_status = 'active'
            and (
              students.app_subscription_expires_at is null
              or students.app_subscription_expires_at > now()
            )
          )
          or students.access_override_until > now()
        )
      )
  );
$$;

revoke all on function public.coachfit_student_financial_access_by_invite(text) from public, anon, authenticated;

-- Evita novas duplicidades dentro da carteira de um mesmo profissional.
-- Registros legados não são apagados nem mesclados automaticamente.
create or replace function public.coachfit_guard_student_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(new.email, '')));
  normalized_phone text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  old_email text;
  old_phone text;
begin
  if tg_op = 'UPDATE' then
    old_email := lower(btrim(coalesce(old.email, '')));
    old_phone := regexp_replace(coalesce(old.phone, ''), '\D', '', 'g');

    if new.coach_id is not distinct from old.coach_id
       and normalized_email is not distinct from old_email
       and normalized_phone is not distinct from old_phone then
      return new;
    end if;
  end if;

  if normalized_email <> '' and exists (
    select 1
    from public.students as existing
    where existing.coach_id = new.coach_id
      and existing.id is distinct from new.id
      and lower(btrim(coalesce(existing.email, ''))) = normalized_email
  ) then
    raise exception 'Já existe um aluno/paciente com este e-mail para este profissional.'
      using errcode = '23505';
  end if;

  if normalized_phone <> '' and exists (
    select 1
    from public.students as existing
    where existing.coach_id = new.coach_id
      and existing.id is distinct from new.id
      and regexp_replace(coalesce(existing.phone, ''), '\D', '', 'g') = normalized_phone
  ) then
    raise exception 'Já existe um aluno/paciente com este telefone para este profissional.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists coachfit_guard_student_identity on public.students;
create trigger coachfit_guard_student_identity
before insert or update of coach_id, email, phone
on public.students
for each row execute function public.coachfit_guard_student_identity();

revoke all on function public.coachfit_guard_student_identity() from public, anon, authenticated;

commit;
