begin;

insert into public.app_admin_settings (key, settings, updated_at)
values (
  'affiliate_program',
  jsonb_build_object(
    'monthlyFeeCents', 2500,
    'commissionRate', 0.25
  ),
  now()
)
on conflict (key) do nothing;

alter table public.payment_webhook_events
  add column if not exists correlation_id text,
  add column if not exists authenticated boolean not null default false,
  add column if not exists auth_method text,
  add column if not exists provider_event_at timestamptz,
  add column if not exists processing_result text;

alter table public.student_checkout_sessions
  add column if not exists last_provider_event_id text,
  add column if not exists last_provider_event_at timestamptz;

create unique index if not exists students_coach_email_unique_norm
  on public.students (coach_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '';

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

drop policy if exists "affiliate_student_payments_owner_select" on public.affiliate_student_payments;
create policy "affiliate_student_payments_owner_select"
on public.affiliate_student_payments
for select
to authenticated
using (
  coach_id = auth.uid()
  and affiliate_email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
);

create or replace function public.get_my_affiliate_report(
  p_start_date date default date_trunc('month', current_date)::date,
  p_end_date date default current_date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  start_date date := coalesce(p_start_date, date_trunc('month', current_date)::date);
  end_date date := coalesce(p_end_date, current_date);
  end_exclusive timestamptz;
  current_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  result jsonb;
begin
  if auth.uid() is null or current_email = '' then
    raise exception 'Sessao expirada' using errcode = '42501';
  end if;

  if start_date > end_date then
    raise exception 'A data inicial não pode ser maior que a data final.' using errcode = '22007';
  end if;

  if (end_date - start_date) > 1095 then
    raise exception 'O período máximo permitido é de 3 anos.' using errcode = '22007';
  end if;

  if not public.coachfit_current_professional_is_affiliate() then
    raise exception 'Profissional não pertence ao programa de afiliados.' using errcode = '42501';
  end if;

  end_exclusive := (end_date + 1)::timestamptz;

  select jsonb_build_object(
    'period', jsonb_build_object(
      'startDate', start_date,
      'endDate', end_date
    ),
    'totals', jsonb_build_object(
      'referredClients', (
        select count(*)::int
        from public.students as students
        where students.coach_id = auth.uid()
      ),
      'activeClients', (
        select count(*)::int
        from public.students as students
        where students.coach_id = auth.uid()
          and students.app_payment_status = 'active'
          and (
            students.app_subscription_expires_at is null
            or students.app_subscription_expires_at > now()
          )
      ),
      'paidClients', (
        select count(distinct payments.student_id)::int
        from public.affiliate_student_payments as payments
        where payments.coach_id = auth.uid()
          and payments.affiliate_email = current_email
          and payments.status = 'paid'
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
      ),
      'sales', (
        select count(*)::int
        from public.affiliate_student_payments as payments
        where payments.coach_id = auth.uid()
          and payments.affiliate_email = current_email
          and payments.status = 'paid'
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
      ),
      'revenueCents', (
        select coalesce(sum(payments.revenue_cents), 0)::int
        from public.affiliate_student_payments as payments
        where payments.coach_id = auth.uid()
          and payments.affiliate_email = current_email
          and payments.status = 'paid'
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
      ),
      'commissionCents', (
        select coalesce(sum(payments.commission_cents), 0)::int
        from public.affiliate_student_payments as payments
        where payments.coach_id = auth.uid()
          and payments.affiliate_email = current_email
          and payments.status = 'paid'
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
      )
    ),
    'sales', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'paymentId', payments.id,
          'studentId', payments.student_id,
          'studentName', coalesce(nullif(btrim(students.name), ''), 'Aluno/Paciente'),
          'paidAt', payments.paid_at,
          'revenueCents', payments.revenue_cents,
          'commissionCents', payments.commission_cents,
          'status', payments.status,
          'providerOrderId', coalesce(payments.provider_order_id, '')
        )
        order by payments.paid_at desc
      )
      from public.affiliate_student_payments as payments
      left join public.students as students
        on students.id = payments.student_id
       and students.coach_id = auth.uid()
      where payments.coach_id = auth.uid()
        and payments.affiliate_email = current_email
        and payments.status = 'paid'
        and payments.paid_at >= start_date::timestamptz
        and payments.paid_at < end_exclusive
    ), '[]'::jsonb)
  )
  into result;

  return coalesce(result, jsonb_build_object(
    'period', jsonb_build_object('startDate', start_date, 'endDate', end_date),
    'totals', jsonb_build_object(
      'referredClients', 0,
      'activeClients', 0,
      'paidClients', 0,
      'sales', 0,
      'revenueCents', 0,
      'commissionCents', 0
    ),
    'sales', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.get_my_affiliate_report(date, date) from public, anon;
grant execute on function public.get_my_affiliate_report(date, date) to authenticated;

commit;
