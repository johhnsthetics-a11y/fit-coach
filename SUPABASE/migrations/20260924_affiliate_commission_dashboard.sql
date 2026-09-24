begin;

create table if not exists public.affiliate_student_payments (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id text not null unique,
  coach_id uuid references public.users(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  affiliate_email text not null,
  status text not null default 'paid',
  paid_at timestamptz not null,
  payment_month date not null,
  revenue_cents integer not null default 2500,
  provider_amount_cents integer,
  commission_rate numeric(5,4) not null default 0.2500,
  commission_cents integer not null default 625,
  provider text not null default 'cartpanda',
  provider_order_id text,
  provider_subscription_id text,
  reversal_event_id text,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_student_payments_status_check
    check (status in ('paid', 'refunded', 'chargeback')),
  constraint affiliate_student_payments_revenue_check
    check (revenue_cents > 0),
  constraint affiliate_student_payments_commission_rate_check
    check (commission_rate >= 0 and commission_rate <= 1),
  constraint affiliate_student_payments_commission_check
    check (commission_cents >= 0)
);

comment on table public.affiliate_student_payments is
  'Livro-caixa das mensalidades Cartpanda confirmadas dos alunos/pacientes de profissionais afiliados. Regra comercial atual: R$25,00 por mensalidade paga e 25% de comissão.';

create index if not exists affiliate_student_payments_month_idx
  on public.affiliate_student_payments(payment_month);
create index if not exists affiliate_student_payments_affiliate_month_idx
  on public.affiliate_student_payments(affiliate_email, payment_month);
create index if not exists affiliate_student_payments_coach_month_idx
  on public.affiliate_student_payments(coach_id, payment_month);
create index if not exists affiliate_student_payments_student_idx
  on public.affiliate_student_payments(student_id);
create index if not exists affiliate_student_payments_subscription_idx
  on public.affiliate_student_payments(provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists affiliate_student_payments_order_idx
  on public.affiliate_student_payments(provider_order_id)
  where provider_order_id is not null;

alter table public.affiliate_student_payments enable row level security;

revoke all on table public.affiliate_student_payments from public, anon, authenticated;
grant select on table public.affiliate_student_payments to authenticated;

drop policy if exists "affiliate_student_payments_master_select" on public.affiliate_student_payments;
create policy "affiliate_student_payments_master_select"
on public.affiliate_student_payments
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'sac@coachfitpro.com.br'
);

create or replace function public.get_affiliate_commission_dashboard(p_month date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  month_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month')::date;
  result jsonb;
begin
  if auth.uid() is null
     or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'sac@coachfitpro.com.br' then
    raise exception 'Acesso exclusivo do Admin Master.' using errcode = '42501';
  end if;

  with affiliate_keys as (
    select
      affiliates.email,
      affiliates.active
    from public.affiliate_professionals as affiliates

    union

    select
      payments.affiliate_email as email,
      false as active
    from public.affiliate_student_payments as payments
    where payments.payment_month = month_start
      and not exists (
        select 1
        from public.affiliate_professionals as current_affiliate
        where current_affiliate.email = payments.affiliate_email
      )
  ),
  affiliate_rows as (
    select
      keys.email,
      keys.active,
      users.id as coach_id,
      coalesce(nullif(btrim(users.name), ''), keys.email) as professional_name,
      case
        when lower(coalesce(users.role, '')) like '%nutri%' then 'nutritionist'
        else 'trainer'
      end as professional_type,
      (
        select count(*)::int
        from public.students as students
        where students.coach_id = users.id
      ) as students_brought,
      (
        select count(distinct payments.student_id)::int
        from public.affiliate_student_payments as payments
        where payments.affiliate_email = keys.email
          and payments.payment_month = month_start
          and payments.status = 'paid'
      ) as paid_students,
      (
        select count(*)::int
        from public.affiliate_student_payments as payments
        where payments.affiliate_email = keys.email
          and payments.payment_month = month_start
          and payments.status = 'paid'
      ) as paid_installments,
      (
        select coalesce(sum(payments.revenue_cents), 0)::int
        from public.affiliate_student_payments as payments
        where payments.affiliate_email = keys.email
          and payments.payment_month = month_start
          and payments.status = 'paid'
      ) as revenue_cents,
      (
        select coalesce(sum(payments.commission_cents), 0)::int
        from public.affiliate_student_payments as payments
        where payments.affiliate_email = keys.email
          and payments.payment_month = month_start
          and payments.status = 'paid'
      ) as commission_cents
    from affiliate_keys as keys
    left join public.users as users
      on lower(btrim(users.email)) = keys.email
  ),
  totals as (
    select
      coalesce(sum(rows.students_brought), 0)::int as students_brought,
      coalesce(sum(rows.paid_students), 0)::int as paid_students,
      coalesce(sum(rows.paid_installments), 0)::int as paid_installments,
      coalesce(sum(rows.revenue_cents), 0)::int as revenue_cents,
      coalesce(sum(rows.commission_cents), 0)::int as commission_cents
    from affiliate_rows as rows
  )
  select jsonb_build_object(
    'month', to_char(month_start, 'YYYY-MM'),
    'monthStart', month_start,
    'monthEndExclusive', month_end,
    'monthlyFeeCents', 2500,
    'commissionRate', 0.25,
    'commissionPerPaidInstallmentCents', 625,
    'totals', jsonb_build_object(
      'studentsBrought', totals.students_brought,
      'paidStudents', totals.paid_students,
      'paidInstallments', totals.paid_installments,
      'revenueCents', totals.revenue_cents,
      'commissionCents', totals.commission_cents
    ),
    'affiliates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'email', rows.email,
          'active', rows.active,
          'coachId', rows.coach_id,
          'professionalName', rows.professional_name,
          'professionalType', rows.professional_type,
          'studentsBrought', rows.students_brought,
          'paidStudents', rows.paid_students,
          'paidInstallments', rows.paid_installments,
          'revenueCents', rows.revenue_cents,
          'commissionCents', rows.commission_cents
        )
        order by rows.commission_cents desc, rows.professional_name asc
      )
      from affiliate_rows as rows
    ), '[]'::jsonb)
  )
  into result
  from totals;

  return coalesce(result, jsonb_build_object(
    'month', to_char(month_start, 'YYYY-MM'),
    'monthlyFeeCents', 2500,
    'commissionRate', 0.25,
    'commissionPerPaidInstallmentCents', 625,
    'totals', jsonb_build_object(
      'studentsBrought', 0,
      'paidStudents', 0,
      'paidInstallments', 0,
      'revenueCents', 0,
      'commissionCents', 0
    ),
    'affiliates', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.get_affiliate_commission_dashboard(date) from public, anon;
grant execute on function public.get_affiliate_commission_dashboard(date) to authenticated;

insert into public.affiliate_student_payments (
  webhook_event_id,
  coach_id,
  student_id,
  affiliate_email,
  status,
  paid_at,
  payment_month,
  revenue_cents,
  provider_amount_cents,
  commission_rate,
  commission_cents,
  provider,
  provider_order_id,
  provider_subscription_id
)
select
  events.event_id,
  sessions.coach_id,
  sessions.student_id,
  affiliates.email,
  'paid',
  coalesce(events.received_at, sessions.paid_at, now()),
  date_trunc('month', coalesce(events.received_at, sessions.paid_at, now()))::date,
  2500,
  events.amount_cents,
  0.2500,
  625,
  'cartpanda',
  events.provider_order_id,
  events.provider_subscription_id
from public.payment_webhook_events as events
join public.student_checkout_sessions as sessions
  on (
    events.provider_order_id is not null
    and events.provider_order_id <> ''
    and sessions.provider_order_id = events.provider_order_id
  )
  or (
    events.provider_subscription_id is not null
    and events.provider_subscription_id <> ''
    and sessions.provider_subscription_id = events.provider_subscription_id
  )
join public.users as users
  on users.id = sessions.coach_id
join public.affiliate_professionals as affiliates
  on affiliates.email = lower(btrim(users.email))
 and affiliates.active = true
where events.processed = true
  and events.subscription_status = 'active'
  and events.event_id is not null
  and (
    lower(coalesce(events.event_type, '')) ~ '(paid|approved|aprov|complete|completed|confirm|captured|initial_sale)'
    or lower(events.payload::text) ~ '(paid|approved|aprov|complete|completed|confirm|captured|initial_sale)'
  )
on conflict (webhook_event_id) do nothing;

commit;
