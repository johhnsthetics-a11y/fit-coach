begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.affiliate_professionals
  add column if not exists professional_type text;

update public.affiliate_professionals as affiliates
set professional_type = case
  when lower(coalesce(users.role, '')) like '%nutri%' then 'nutritionist'
  else 'trainer'
end
from public.users as users
where lower(btrim(users.email)) = affiliates.email
  and affiliates.professional_type is null;

update public.affiliate_professionals
set professional_type = 'trainer'
where professional_type is null;

alter table public.affiliate_professionals
  alter column professional_type set default 'trainer',
  alter column professional_type set not null;

alter table public.affiliate_professionals
  drop constraint if exists affiliate_professionals_professional_type_check;
alter table public.affiliate_professionals
  add constraint affiliate_professionals_professional_type_check
  check (professional_type in ('trainer', 'nutritionist'));

create table if not exists public.affiliate_professional_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_professionals(id) on delete restrict,
  affiliate_email text not null,
  referred_email text not null,
  professional_type text not null,
  invite_token_hash bytea not null unique,
  status text not null default 'pending',
  referred_user_id uuid references public.users(id) on delete set null,
  claimed_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_professional_referrals_affiliate_email_check
    check (affiliate_email = lower(btrim(affiliate_email)) and position('@' in affiliate_email) > 1),
  constraint affiliate_professional_referrals_referred_email_check
    check (referred_email = lower(btrim(referred_email)) and position('@' in referred_email) > 1),
  constraint affiliate_professional_referrals_type_check
    check (professional_type in ('trainer', 'nutritionist')),
  constraint affiliate_professional_referrals_status_check
    check (status in ('pending', 'claimed', 'converted', 'canceled')),
  constraint affiliate_professional_referrals_claim_check
    check (
      (status in ('pending', 'canceled') and referred_user_id is null)
      or (status in ('claimed', 'converted') and referred_user_id is not null)
    )
);

create unique index if not exists affiliate_professional_referrals_active_email_idx
  on public.affiliate_professional_referrals(referred_email)
  where status in ('pending', 'claimed', 'converted');
create index if not exists affiliate_professional_referrals_affiliate_idx
  on public.affiliate_professional_referrals(affiliate_id, created_at desc);
create index if not exists affiliate_professional_referrals_user_idx
  on public.affiliate_professional_referrals(referred_user_id)
  where referred_user_id is not null;

create table if not exists public.affiliate_professional_payments (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.affiliate_professional_referrals(id) on delete restrict,
  affiliate_id uuid not null references public.affiliate_professionals(id) on delete restrict,
  affiliate_email text not null,
  referred_user_id uuid not null references public.users(id) on delete restrict,
  webhook_event_id text not null unique,
  provider text not null default 'cartpanda',
  provider_order_id text,
  provider_subscription_id text,
  product_id text,
  plan_cycle text,
  gross_amount_cents integer not null,
  commission_rate numeric(5,4) not null default 0.5000,
  commission_cents integer not null,
  status text not null default 'paid',
  paid_at timestamptz not null,
  reversal_event_id text,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_professional_payments_email_check
    check (affiliate_email = lower(btrim(affiliate_email)) and position('@' in affiliate_email) > 1),
  constraint affiliate_professional_payments_cycle_check
    check (plan_cycle is null or plan_cycle in ('monthly', 'semiannual', 'annual')),
  constraint affiliate_professional_payments_amount_check
    check (gross_amount_cents > 0),
  constraint affiliate_professional_payments_rate_check
    check (commission_rate = 0.5000),
  constraint affiliate_professional_payments_commission_check
    check (commission_cents = round(gross_amount_cents * commission_rate)::integer),
  constraint affiliate_professional_payments_status_check
    check (status in ('paid', 'refunded', 'chargeback'))
);

create unique index if not exists affiliate_professional_payments_order_idx
  on public.affiliate_professional_payments(provider, provider_order_id)
  where provider_order_id is not null and btrim(provider_order_id) <> '';
create index if not exists affiliate_professional_payments_affiliate_idx
  on public.affiliate_professional_payments(affiliate_id, paid_at desc);
create index if not exists affiliate_professional_payments_referral_idx
  on public.affiliate_professional_payments(referral_id, paid_at desc);
create index if not exists affiliate_professional_payments_subscription_idx
  on public.affiliate_professional_payments(provider_subscription_id)
  where provider_subscription_id is not null and btrim(provider_subscription_id) <> '';

alter table public.affiliate_professional_referrals enable row level security;
alter table public.affiliate_professional_payments enable row level security;

revoke all on table public.affiliate_professional_referrals from public, anon, authenticated;
revoke all on table public.affiliate_professional_payments from public, anon, authenticated;

create or replace function public.coachfit_professional_type_from_role(p_role text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when lower(coalesce(p_role, '')) like '%nutri%' then 'nutritionist'
    when lower(coalesce(p_role, '')) ~ '(trainer|treinador|coach|personal)' then 'trainer'
    else null
  end;
$$;

revoke all on function public.coachfit_professional_type_from_role(text) from public, anon, authenticated;

create or replace function public.create_affiliate_professional_referral(
  p_referred_email text,
  p_professional_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  normalized_email text := lower(btrim(coalesce(p_referred_email, '')));
  normalized_type text := lower(btrim(coalesce(p_professional_type, '')));
  current_affiliate public.affiliate_professionals%rowtype;
  raw_token bytea;
  open_token text;
  created_referral public.affiliate_professional_referrals%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;

  select lower(btrim(users.email))
  into current_email
  from public.users as users
  where users.id = current_user_id
  limit 1;

  select affiliates.*
  into current_affiliate
  from public.affiliate_professionals as affiliates
  where affiliates.email = current_email
    and affiliates.active = true
  limit 1;

  if current_affiliate.id is null then
    raise exception 'Recurso disponivel somente para afiliado ativo.' using errcode = '42501';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'errorCode', 'invalid_email');
  end if;

  if normalized_type not in ('trainer', 'nutritionist') then
    return jsonb_build_object('ok', false, 'errorCode', 'invalid_professional_type');
  end if;

  if normalized_email = current_email then
    return jsonb_build_object('ok', false, 'errorCode', 'self_referral');
  end if;

  if exists (
    select 1
    from public.users as users
    join public.coach_subscriptions as subscriptions
      on subscriptions.coach_id = users.id
    where lower(btrim(users.email)) = normalized_email
      and lower(coalesce(subscriptions.status, '')) in ('active', 'paid', 'trialing')
      and (
        subscriptions.current_period_ends_at is null
        or subscriptions.current_period_ends_at > now()
      )
  ) then
    return jsonb_build_object('ok', false, 'errorCode', 'already_subscribed');
  end if;

  raw_token := extensions.gen_random_bytes(32);
  open_token := encode(raw_token, 'hex');

  begin
    insert into public.affiliate_professional_referrals (
      affiliate_id,
      affiliate_email,
      referred_email,
      professional_type,
      invite_token_hash
    ) values (
      current_affiliate.id,
      current_affiliate.email,
      normalized_email,
      normalized_type,
      extensions.digest(raw_token, 'sha256')
    )
    returning * into created_referral;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'errorCode', 'referral_conflict');
  end;

  return jsonb_build_object(
    'ok', true,
    'token', open_token,
    'referral', jsonb_build_object(
      'id', created_referral.id,
      'referredEmail', created_referral.referred_email,
      'professionalType', created_referral.professional_type,
      'status', created_referral.status,
      'createdAt', created_referral.created_at
    )
  );
end;
$$;

create or replace function public.claim_affiliate_professional_referral(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  current_type text;
  normalized_token text := lower(btrim(coalesce(p_token, '')));
  current_referral public.affiliate_professional_referrals%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;

  if normalized_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'errorCode', 'invalid_token');
  end if;

  select
    lower(btrim(users.email)),
    public.coachfit_professional_type_from_role(users.role)
  into current_email, current_type
  from public.users as users
  where users.id = current_user_id
  limit 1;

  if current_email is null then
    return jsonb_build_object('ok', false, 'errorCode', 'profile_not_found');
  end if;

  select referrals.*
  into current_referral
  from public.affiliate_professional_referrals as referrals
  where referrals.invite_token_hash = extensions.digest(decode(normalized_token, 'hex'), 'sha256')
  limit 1
  for update;

  if current_referral.id is null or current_referral.status = 'canceled' then
    return jsonb_build_object('ok', false, 'errorCode', 'invalid_token');
  end if;

  if current_referral.referred_email <> current_email then
    return jsonb_build_object('ok', false, 'errorCode', 'email_mismatch');
  end if;

  if current_type is null or current_referral.professional_type <> current_type then
    return jsonb_build_object('ok', false, 'errorCode', 'professional_type_mismatch');
  end if;

  if current_referral.referred_user_id is not null
     and current_referral.referred_user_id <> current_user_id then
    return jsonb_build_object('ok', false, 'errorCode', 'referral_unavailable');
  end if;

  if exists (
    select 1
    from public.coach_subscriptions as subscriptions
    where subscriptions.coach_id = current_user_id
      and lower(coalesce(subscriptions.status, '')) in ('active', 'paid', 'trialing')
      and (
        subscriptions.current_period_ends_at is null
        or subscriptions.current_period_ends_at > now()
      )
  ) then
    return jsonb_build_object('ok', false, 'errorCode', 'already_subscribed');
  end if;

  if current_referral.status = 'pending' then
    update public.affiliate_professional_referrals as referrals
    set
      status = 'claimed',
      referred_user_id = current_user_id,
      claimed_at = coalesce(referrals.claimed_at, now()),
      updated_at = now()
    where referrals.id = current_referral.id
      and referrals.status = 'pending'
      and referrals.referred_user_id is null
    returning * into current_referral;

    if current_referral.id is null then
      return jsonb_build_object('ok', false, 'errorCode', 'referral_unavailable');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'referral', jsonb_build_object(
      'id', current_referral.id,
      'referredEmail', current_referral.referred_email,
      'professionalType', current_referral.professional_type,
      'status', current_referral.status,
      'claimedAt', current_referral.claimed_at
    )
  );
end;
$$;

create or replace function public.cancel_affiliate_professional_referral(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_affiliate_id uuid;
  canceled_referral public.affiliate_professional_referrals%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;

  select affiliates.id
  into current_affiliate_id
  from public.users as users
  join public.affiliate_professionals as affiliates
    on affiliates.email = lower(btrim(users.email))
   and affiliates.active = true
  where users.id = current_user_id
  limit 1;

  if current_affiliate_id is null then
    raise exception 'Recurso disponivel somente para afiliado ativo.' using errcode = '42501';
  end if;

  update public.affiliate_professional_referrals as referrals
  set status = 'canceled', updated_at = now()
  where referrals.id = p_referral_id
    and referrals.affiliate_id = current_affiliate_id
    and referrals.status = 'pending'
  returning * into canceled_referral;

  if canceled_referral.id is null then
    return jsonb_build_object('ok', false, 'errorCode', 'referral_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'referral', jsonb_build_object(
      'id', canceled_referral.id,
      'status', canceled_referral.status
    )
  );
end;
$$;

create or replace function public.get_my_professional_referrals()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_affiliate_id uuid;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;

  select affiliates.id
  into current_affiliate_id
  from public.users as users
  join public.affiliate_professionals as affiliates
    on affiliates.email = lower(btrim(users.email))
   and affiliates.active = true
  where users.id = current_user_id
  limit 1;

  if current_affiliate_id is null then
    raise exception 'Recurso disponivel somente para afiliado ativo.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'referrals', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', referrals.id,
        'referredEmail', referrals.referred_email,
        'professionalType', referrals.professional_type,
        'status', referrals.status,
        'referredUserId', referrals.referred_user_id,
        'claimedAt', referrals.claimed_at,
        'convertedAt', referrals.converted_at,
        'createdAt', referrals.created_at,
        'updatedAt', referrals.updated_at
      ) order by referrals.created_at desc
    ), '[]'::jsonb)
  )
  into result
  from public.affiliate_professional_referrals as referrals
  where referrals.affiliate_id = current_affiliate_id;

  return coalesce(result, jsonb_build_object('referrals', '[]'::jsonb));
end;
$$;

revoke all on function public.create_affiliate_professional_referral(text, text) from public, anon, authenticated;
revoke all on function public.claim_affiliate_professional_referral(text) from public, anon, authenticated;
revoke all on function public.cancel_affiliate_professional_referral(uuid) from public, anon, authenticated;
revoke all on function public.get_my_professional_referrals() from public, anon, authenticated;
grant execute on function public.create_affiliate_professional_referral(text, text) to authenticated;
grant execute on function public.claim_affiliate_professional_referral(text) to authenticated;
grant execute on function public.cancel_affiliate_professional_referral(uuid) to authenticated;
grant execute on function public.get_my_professional_referrals() to authenticated;

create or replace function public.get_my_commission_report(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Sao_Paulo'
as $$
declare
  current_user_id uuid := auth.uid();
  start_date date := coalesce(p_start_date, current_date - 29);
  end_date date := coalesce(p_end_date, current_date);
  end_exclusive timestamptz;
  current_affiliate public.affiliate_professionals%rowtype;
  student_paid_clients integer := 0;
  student_paid_installments integer := 0;
  student_revenue_cents integer := 0;
  student_commission_cents integer := 0;
  professional_paid_clients integer := 0;
  professional_paid_installments integer := 0;
  professional_revenue_cents integer := 0;
  professional_commission_cents integer := 0;
  student_clients jsonb := '[]'::jsonb;
  professional_payments jsonb := '[]'::jsonb;
  professional_referrals jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;
  if start_date > end_date or (end_date - start_date) > 1095 then
    raise exception 'Periodo invalido.' using errcode = '22007';
  end if;

  select affiliates.*
  into current_affiliate
  from public.users as users
  join public.affiliate_professionals as affiliates
    on affiliates.email = lower(btrim(users.email))
   and affiliates.active = true
  where users.id = current_user_id
  limit 1;

  if current_affiliate.id is null then
    raise exception 'Relatorio de comissoes indisponivel para esta conta.' using errcode = '42501';
  end if;

  end_exclusive := (end_date + 1)::timestamptz;

  select
    count(distinct payments.student_id)::integer,
    count(*)::integer,
    coalesce(sum(payments.revenue_cents), 0)::integer,
    coalesce(sum(payments.commission_cents), 0)::integer
  into student_paid_clients, student_paid_installments, student_revenue_cents, student_commission_cents
  from public.affiliate_student_payments as payments
  where payments.coach_id = current_user_id
    and payments.affiliate_email = current_affiliate.email
    and payments.paid_at >= start_date::timestamptz
    and payments.paid_at < end_exclusive
    and payments.status = 'paid';

  select coalesce(jsonb_agg(row_data order by (row_data ->> 'commissionCents')::integer desc), '[]'::jsonb)
  into student_clients
  from (
    select jsonb_build_object(
      'studentId', payments.student_id,
      'clientName', coalesce(nullif(btrim(students.name), ''), 'Aluno/Paciente'),
      'clientEmail', coalesce(students.email, ''),
      'appPaymentStatus', coalesce(students.app_payment_status, 'pending'),
      'paymentCount', count(*)::integer,
      'revenueCents', coalesce(sum(payments.revenue_cents), 0)::integer,
      'commissionCents', coalesce(sum(payments.commission_cents), 0)::integer,
      'lastPaidAt', max(payments.paid_at)
    ) as row_data
    from public.affiliate_student_payments as payments
    left join public.students as students
      on students.id = payments.student_id
     and students.coach_id = current_user_id
    where payments.coach_id = current_user_id
      and payments.affiliate_email = current_affiliate.email
      and payments.paid_at >= start_date::timestamptz
      and payments.paid_at < end_exclusive
      and payments.status = 'paid'
    group by payments.student_id, students.name, students.email, students.app_payment_status
  ) as client_rows;

  select
    count(distinct payments.referred_user_id)::integer,
    count(*)::integer,
    coalesce(sum(payments.gross_amount_cents), 0)::integer,
    coalesce(sum(payments.commission_cents), 0)::integer
  into professional_paid_clients, professional_paid_installments, professional_revenue_cents, professional_commission_cents
  from public.affiliate_professional_payments as payments
  where payments.affiliate_id = current_affiliate.id
    and payments.affiliate_email = current_affiliate.email
    and payments.paid_at >= start_date::timestamptz
    and payments.paid_at < end_exclusive
    and payments.status = 'paid';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'paymentId', payments.id,
      'referralId', payments.referral_id,
      'referredUserId', payments.referred_user_id,
      'referredName', coalesce(nullif(btrim(users.name), ''), users.email, 'Profissional'),
      'referredEmail', coalesce(users.email, ''),
      'professionalType', referrals.professional_type,
      'planCycle', coalesce(payments.plan_cycle, ''),
      'productId', coalesce(payments.product_id, ''),
      'paidAt', payments.paid_at,
      'grossAmountCents', payments.gross_amount_cents,
      'commissionRate', payments.commission_rate,
      'commissionCents', payments.commission_cents,
      'providerOrderId', coalesce(payments.provider_order_id, ''),
      'providerSubscriptionId', coalesce(payments.provider_subscription_id, ''),
      'status', payments.status
    ) order by payments.paid_at desc
  ), '[]'::jsonb)
  into professional_payments
  from public.affiliate_professional_payments as payments
  join public.affiliate_professional_referrals as referrals on referrals.id = payments.referral_id
  left join public.users as users on users.id = payments.referred_user_id
  where payments.affiliate_id = current_affiliate.id
    and payments.affiliate_email = current_affiliate.email
    and payments.paid_at >= start_date::timestamptz
    and payments.paid_at < end_exclusive;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', referrals.id,
      'referredEmail', referrals.referred_email,
      'professionalType', referrals.professional_type,
      'status', referrals.status,
      'referredUserId', referrals.referred_user_id,
      'claimedAt', referrals.claimed_at,
      'convertedAt', referrals.converted_at,
      'createdAt', referrals.created_at
    ) order by referrals.created_at desc
  ), '[]'::jsonb)
  into professional_referrals
  from public.affiliate_professional_referrals as referrals
  where referrals.affiliate_id = current_affiliate.id;

  return jsonb_build_object(
    'period', jsonb_build_object('startDate', start_date, 'endDate', end_date),
    'monthlyFeeCents', 2500,
    'commissionRate', 0.25,
    'commissionPerPaidInstallmentCents', 625,
    'totals', jsonb_build_object(
      'paidClients', student_paid_clients,
      'paidInstallments', student_paid_installments,
      'revenueCents', student_revenue_cents,
      'commissionCents', student_commission_cents
    ),
    'clients', student_clients,
    'studentCommissions', jsonb_build_object(
      'commissionRate', 0.25,
      'totals', jsonb_build_object(
        'paidClients', student_paid_clients,
        'paidInstallments', student_paid_installments,
        'revenueCents', student_revenue_cents,
        'commissionCents', student_commission_cents
      ),
      'clients', student_clients
    ),
    'professionalCommissions', jsonb_build_object(
      'commissionRate', 0.50,
      'totals', jsonb_build_object(
        'paidProfessionals', professional_paid_clients,
        'paidInstallments', professional_paid_installments,
        'revenueCents', professional_revenue_cents,
        'commissionCents', professional_commission_cents
      ),
      'payments', professional_payments,
      'referrals', professional_referrals
    ),
    'consolidatedTotals', jsonb_build_object(
      'paidAccounts', student_paid_clients + professional_paid_clients,
      'paidInstallments', student_paid_installments + professional_paid_installments,
      'revenueCents', student_revenue_cents + professional_revenue_cents,
      'commissionCents', student_commission_cents + professional_commission_cents
    )
  );
end;
$$;

create or replace function public.get_affiliate_finance_report(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'America/Sao_Paulo'
as $$
declare
  start_date date := coalesce(p_start_date, current_date - 29);
  end_date date := coalesce(p_end_date, current_date);
  end_exclusive timestamptz;
  result jsonb;
begin
  if start_date > end_date or (end_date - start_date) > 1095 then
    raise exception 'Periodo invalido.' using errcode = '22007';
  end if;
  if auth.uid() is null
     or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'sac@coachfitpro.com.br' then
    raise exception 'Acesso exclusivo do Admin Master.' using errcode = '42501';
  end if;

  end_exclusive := (end_date + 1)::timestamptz;

  with affiliate_rows as (
    select
      affiliates.id as affiliate_id,
      affiliates.email,
      affiliates.active,
      affiliates.professional_type,
      users.id as coach_id,
      coalesce(nullif(btrim(users.name), ''), affiliates.email) as professional_name,
      (select count(*)::integer from public.students as students where students.coach_id = users.id) as students_brought,
      (select count(*)::integer from public.students as students where students.coach_id = users.id and students.created_at >= start_date::timestamptz and students.created_at < end_exclusive) as new_students_in_period,
      (select count(distinct payments.student_id)::integer from public.affiliate_student_payments as payments where payments.affiliate_email = affiliates.email and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive and payments.status = 'paid') as paid_students,
      (select count(*)::integer from public.affiliate_student_payments as payments where payments.affiliate_email = affiliates.email and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive and payments.status = 'paid') as paid_installments,
      (select coalesce(sum(payments.revenue_cents), 0)::integer from public.affiliate_student_payments as payments where payments.affiliate_email = affiliates.email and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive and payments.status = 'paid') as revenue_cents,
      (select coalesce(sum(payments.commission_cents), 0)::integer from public.affiliate_student_payments as payments where payments.affiliate_email = affiliates.email and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive and payments.status = 'paid') as commission_cents,
      (select count(*)::integer from public.affiliate_professional_referrals as referrals where referrals.affiliate_id = affiliates.id and referrals.status <> 'canceled') as professional_referrals_count,
      (select count(*)::integer from public.affiliate_professional_referrals as referrals where referrals.affiliate_id = affiliates.id and referrals.status = 'converted') as converted_professionals,
      (select count(distinct payments.referred_user_id)::integer from public.affiliate_professional_payments as payments where payments.affiliate_id = affiliates.id and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive and payments.status = 'paid') as paid_professionals,
      (select count(*)::integer from public.affiliate_professional_payments as payments where payments.affiliate_id = affiliates.id and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive and payments.status = 'paid') as professional_paid_installments,
      (select coalesce(sum(payments.gross_amount_cents), 0)::integer from public.affiliate_professional_payments as payments where payments.affiliate_id = affiliates.id and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive and payments.status = 'paid') as professional_revenue_cents,
      (select coalesce(sum(payments.commission_cents), 0)::integer from public.affiliate_professional_payments as payments where payments.affiliate_id = affiliates.id and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive and payments.status = 'paid') as professional_commission_cents,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'paymentId', payments.id,
        'studentId', payments.student_id,
        'studentName', coalesce(nullif(btrim(students.name), ''), 'Aluno/Paciente'),
        'studentEmail', coalesce(students.email, ''),
        'paidAt', payments.paid_at,
        'revenueCents', payments.revenue_cents,
        'commissionCents', payments.commission_cents,
        'providerAmountCents', payments.provider_amount_cents,
        'providerOrderId', coalesce(payments.provider_order_id, ''),
        'providerSubscriptionId', coalesce(payments.provider_subscription_id, ''),
        'status', payments.status
      ) order by payments.paid_at desc), '[]'::jsonb)
      from public.affiliate_student_payments as payments
      left join public.students as students on students.id = payments.student_id
      where payments.affiliate_email = affiliates.email and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive) as sales,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'paymentId', payments.id,
        'referralId', payments.referral_id,
        'referredUserId', payments.referred_user_id,
        'referredName', coalesce(nullif(btrim(referred.name), ''), referred.email, 'Profissional'),
        'referredEmail', coalesce(referred.email, ''),
        'professionalType', referrals.professional_type,
        'planCycle', coalesce(payments.plan_cycle, ''),
        'paidAt', payments.paid_at,
        'grossAmountCents', payments.gross_amount_cents,
        'commissionRate', payments.commission_rate,
        'commissionCents', payments.commission_cents,
        'providerOrderId', coalesce(payments.provider_order_id, ''),
        'providerSubscriptionId', coalesce(payments.provider_subscription_id, ''),
        'status', payments.status
      ) order by payments.paid_at desc), '[]'::jsonb)
      from public.affiliate_professional_payments as payments
      join public.affiliate_professional_referrals as referrals on referrals.id = payments.referral_id
      left join public.users as referred on referred.id = payments.referred_user_id
      where payments.affiliate_id = affiliates.id and payments.paid_at >= start_date::timestamptz and payments.paid_at < end_exclusive) as professional_payments,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'id', referrals.id,
        'referredEmail', referrals.referred_email,
        'professionalType', referrals.professional_type,
        'status', referrals.status,
        'referredUserId', referrals.referred_user_id,
        'createdAt', referrals.created_at,
        'claimedAt', referrals.claimed_at,
        'convertedAt', referrals.converted_at
      ) order by referrals.created_at desc), '[]'::jsonb)
      from public.affiliate_professional_referrals as referrals
      where referrals.affiliate_id = affiliates.id) as professional_referrals
    from public.affiliate_professionals as affiliates
    left join public.users as users on lower(btrim(users.email)) = affiliates.email
  ),
  totals as (
    select
      count(*)::integer as affiliate_count,
      coalesce(sum(rows.students_brought), 0)::integer as students_brought,
      coalesce(sum(rows.new_students_in_period), 0)::integer as new_students_in_period,
      coalesce(sum(rows.paid_students), 0)::integer as paid_students,
      coalesce(sum(rows.paid_installments), 0)::integer as paid_installments,
      coalesce(sum(rows.revenue_cents), 0)::integer as revenue_cents,
      coalesce(sum(rows.commission_cents), 0)::integer as commission_cents,
      coalesce(sum(rows.professional_referrals_count), 0)::integer as professional_referrals_count,
      coalesce(sum(rows.converted_professionals), 0)::integer as converted_professionals,
      coalesce(sum(rows.paid_professionals), 0)::integer as paid_professionals,
      coalesce(sum(rows.professional_paid_installments), 0)::integer as professional_paid_installments,
      coalesce(sum(rows.professional_revenue_cents), 0)::integer as professional_revenue_cents,
      coalesce(sum(rows.professional_commission_cents), 0)::integer as professional_commission_cents
    from affiliate_rows as rows
  )
  select jsonb_build_object(
    'period', jsonb_build_object('startDate', start_date, 'endDate', end_date),
    'monthlyFeeCents', 2500,
    'commissionRate', 0.25,
    'commissionPerPaidInstallmentCents', 625,
    'totals', jsonb_build_object(
      'affiliateCount', totals.affiliate_count,
      'studentsBrought', totals.students_brought,
      'newStudentsInPeriod', totals.new_students_in_period,
      'paidStudents', totals.paid_students,
      'paidInstallments', totals.paid_installments,
      'revenueCents', totals.revenue_cents,
      'commissionCents', totals.commission_cents
    ),
    'professionalTotals', jsonb_build_object(
      'referrals', totals.professional_referrals_count,
      'convertedProfessionals', totals.converted_professionals,
      'paidProfessionals', totals.paid_professionals,
      'paidInstallments', totals.professional_paid_installments,
      'revenueCents', totals.professional_revenue_cents,
      'commissionCents', totals.professional_commission_cents
    ),
    'consolidatedTotals', jsonb_build_object(
      'paidAccounts', totals.paid_students + totals.paid_professionals,
      'paidInstallments', totals.paid_installments + totals.professional_paid_installments,
      'revenueCents', totals.revenue_cents + totals.professional_revenue_cents,
      'commissionCents', totals.commission_cents + totals.professional_commission_cents
    ),
    'affiliates', coalesce((select jsonb_agg(jsonb_build_object(
      'email', rows.email,
      'active', rows.active,
      'coachId', rows.coach_id,
      'professionalName', rows.professional_name,
      'professionalType', rows.professional_type,
      'studentsBrought', rows.students_brought,
      'newStudentsInPeriod', rows.new_students_in_period,
      'paidStudents', rows.paid_students,
      'paidInstallments', rows.paid_installments,
      'revenueCents', rows.revenue_cents,
      'commissionCents', rows.commission_cents,
      'sales', rows.sales,
      'professionalReferralsCount', rows.professional_referrals_count,
      'convertedProfessionals', rows.converted_professionals,
      'paidProfessionals', rows.paid_professionals,
      'professionalPaidInstallments', rows.professional_paid_installments,
      'professionalRevenueCents', rows.professional_revenue_cents,
      'professionalCommissionCents', rows.professional_commission_cents,
      'professionalPayments', rows.professional_payments,
      'professionalReferrals', rows.professional_referrals,
      'consolidatedRevenueCents', rows.revenue_cents + rows.professional_revenue_cents,
      'consolidatedCommissionCents', rows.commission_cents + rows.professional_commission_cents
    ) order by (rows.commission_cents + rows.professional_commission_cents) desc, rows.professional_name asc) from affiliate_rows as rows), '[]'::jsonb)
  )
  into result
  from totals;

  return result;
end;
$$;

revoke all on function public.get_my_commission_report(date, date) from public, anon, authenticated;
revoke all on function public.get_affiliate_finance_report(date, date) from public, anon, authenticated;
grant execute on function public.get_my_commission_report(date, date) to authenticated;
grant execute on function public.get_affiliate_finance_report(date, date) to authenticated;

commit;
