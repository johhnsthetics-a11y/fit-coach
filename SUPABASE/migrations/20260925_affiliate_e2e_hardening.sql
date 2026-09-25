begin;

-- Affiliate commercial terms live with the affiliate record so webhook and reports
-- do not hide the business rule in multiple code paths.
alter table public.affiliate_professionals
  add column if not exists monthly_fee_cents integer not null default 2500,
  add column if not exists commission_rate numeric(5,4) not null default 0.2500;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'affiliate_professionals_monthly_fee_check'
      and conrelid = 'public.affiliate_professionals'::regclass
  ) then
    alter table public.affiliate_professionals
      add constraint affiliate_professionals_monthly_fee_check
      check (monthly_fee_cents > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'affiliate_professionals_commission_rate_check'
      and conrelid = 'public.affiliate_professionals'::regclass
  ) then
    alter table public.affiliate_professionals
      add constraint affiliate_professionals_commission_rate_check
      check (commission_rate >= 0 and commission_rate <= 1);
  end if;
end $$;

-- Existing e-mails are safe to normalize: production audit found no duplicate
-- normalized e-mail inside the same professional account.
update public.students
set email = lower(btrim(email))
where email is not null
  and btrim(email) <> ''
  and email is distinct from lower(btrim(email));

create unique index if not exists students_coach_normalized_email_uidx
  on public.students (coach_id, lower(btrim(email)))
  where coach_id is not null
    and email is not null
    and btrim(email) <> '';

-- Do not create a phone unique index: the audit found pre-existing phone
-- duplicates and automatically merging them could corrupt real user data.

alter table public.student_checkout_sessions
  add column if not exists last_provider_event_id text,
  add column if not exists last_provider_event_at timestamptz;

create unique index if not exists affiliate_student_payments_provider_order_uidx
  on public.affiliate_student_payments (provider, provider_order_id)
  where provider_order_id is not null
    and btrim(provider_order_id) <> '';

-- The app subscription paid to Coach Fit Pro is independent from the payment
-- that a student may owe directly to their trainer/nutritionist.
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
            and (students.app_subscription_expires_at is null or students.app_subscription_expires_at > now())
          )
          or students.access_override_until > now()
        )
      )
  );
$$;

revoke all on function public.coachfit_student_financial_access_by_invite(text)
  from public, anon, authenticated;

-- Atomically applies one student/patient CartPanda event. This function is a
-- service-only boundary: the public/anon/authenticated roles cannot call it.
create or replace function public.process_student_cartpanda_event(
  p_checkout_token uuid,
  p_event_id text,
  p_event_at timestamptz,
  p_status text,
  p_is_confirmed boolean,
  p_buyer_email text default null,
  p_provider_order_id text default null,
  p_provider_subscription_id text default null,
  p_provider_amount_cents integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.student_checkout_sessions%rowtype;
  v_student public.students%rowtype;
  v_affiliate public.affiliate_professionals%rowtype;
  v_event_at timestamptz := coalesce(p_event_at, now());
  v_status text := lower(btrim(coalesce(p_status, 'pending')));
  v_current_status text;
  v_commission_cents integer;
  v_period_end timestamptz;
  v_duplicate boolean := false;
begin
  if p_checkout_token is null or nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'Evento CartPanda sem identificador seguro.' using errcode = '22023';
  end if;

  if v_status not in ('pending', 'active', 'past_due', 'canceled', 'refunded', 'chargeback') then
    raise exception 'Status CartPanda invalido.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.payment_webhook_events as events
    where events.event_id = p_event_id
      and events.processed = true
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'reason', 'duplicate_event');
  end if;

  select *
  into v_session
  from public.student_checkout_sessions
  where checkout_token = p_checkout_token
  for update;

  if v_session.id is null then
    update public.payment_webhook_events
    set processing_error = 'Student checkout token not found',
        processed = false
    where event_id = p_event_id;

    return jsonb_build_object('ok', false, 'processed', false, 'reason', 'student_checkout_not_found');
  end if;

  -- A never-associated checkout token expires after seven days. Renewals are
  -- still accepted later through the stored provider subscription identifier.
  if v_session.expires_at < now()
     and v_session.provider_subscription_id is null
     and nullif(btrim(coalesce(p_provider_subscription_id, '')), '') is null then
    update public.payment_webhook_events
    set processing_error = 'Student checkout token expired before provider association',
        processed = false
    where event_id = p_event_id;

    return jsonb_build_object('ok', false, 'processed', false, 'reason', 'checkout_expired');
  end if;

  if v_session.last_provider_event_at is not null
     and v_event_at < v_session.last_provider_event_at then
    update public.payment_webhook_events
    set processed = true,
        processing_error = null
    where event_id = p_event_id;

    return jsonb_build_object(
      'ok', true,
      'processed', true,
      'ignored', true,
      'reason', 'stale_event',
      'status', v_session.status
    );
  end if;

  v_current_status := v_session.status;

  if v_status = 'active' and not coalesce(p_is_confirmed, false) then
    v_status := 'pending';
  end if;

  if v_status = 'active' and coalesce(p_is_confirmed, false) then
    if nullif(btrim(coalesce(p_provider_order_id, '')), '') is null then
      update public.payment_webhook_events
      set subscription_status = 'suspicious',
          processing_error = 'Confirmed student payment missing provider order id',
          processed = false
      where event_id = p_event_id;

      return jsonb_build_object('ok', false, 'processed', false, 'reason', 'missing_order_id');
    end if;

    select affiliates.*
    into v_affiliate
    from public.users as users
    join public.affiliate_professionals as affiliates
      on affiliates.email = lower(btrim(users.email))
     and affiliates.active = true
    where users.id = v_session.coach_id
    limit 1;

    if v_affiliate.id is null then
      update public.payment_webhook_events
      set processing_error = 'Student payment received for non-affiliate professional',
          processed = false
      where event_id = p_event_id;

      return jsonb_build_object('ok', false, 'processed', false, 'reason', 'affiliate_not_active');
    end if;

    if p_provider_amount_cents is null
       or p_provider_amount_cents <> v_affiliate.monthly_fee_cents then
      update public.payment_webhook_events
      set subscription_status = 'suspicious',
          processing_error = 'Student payment amount does not match affiliate plan',
          processed = false
      where event_id = p_event_id;

      return jsonb_build_object(
        'ok', false,
        'processed', false,
        'reason', 'amount_mismatch'
      );
    end if;
  end if;

  -- Prevent an unconfirmed/pending event from downgrading a state that already
  -- represents a real provider decision. Refund/chargeback remain terminal for
  -- this checkout session.
  if v_current_status in ('refunded', 'chargeback') and v_status <> v_current_status then
    v_status := v_current_status;
  elsif v_status = 'pending' and v_current_status in ('active', 'past_due', 'canceled') then
    v_status := v_current_status;
  end if;

  select *
  into v_student
  from public.students
  where id = v_session.student_id
    and coach_id = v_session.coach_id
  for update;

  if v_student.id is null then
    update public.payment_webhook_events
    set processing_error = 'Student no longer exists for checkout session',
        processed = false
    where event_id = p_event_id;

    return jsonb_build_object('ok', false, 'processed', false, 'reason', 'student_not_found');
  end if;

  v_period_end := v_student.app_subscription_expires_at;
  if v_status = 'active' and coalesce(p_is_confirmed, false) then
    v_period_end := (v_event_at + interval '1 month');
  end if;

  update public.student_checkout_sessions
  set status = v_status,
      buyer_email = nullif(btrim(coalesce(p_buyer_email, '')), ''),
      provider_order_id = coalesce(nullif(btrim(coalesce(p_provider_order_id, '')), ''), provider_order_id),
      provider_subscription_id = coalesce(nullif(btrim(coalesce(p_provider_subscription_id, '')), ''), provider_subscription_id),
      amount_cents = coalesce(p_provider_amount_cents, amount_cents),
      paid_at = case
        when v_status = 'active' and coalesce(p_is_confirmed, false)
          then coalesce(paid_at, v_event_at)
        else paid_at
      end,
      last_provider_event_id = p_event_id,
      last_provider_event_at = greatest(coalesce(last_provider_event_at, v_event_at), v_event_at),
      updated_at = now()
  where id = v_session.id;

  update public.students
  set app_payment_status = v_status,
      app_subscription_started_at = case
        when v_status = 'active' and coalesce(p_is_confirmed, false)
          then coalesce(app_subscription_started_at, v_event_at)
        else app_subscription_started_at
      end,
      app_subscription_expires_at = case
        when v_status = 'active' and coalesce(p_is_confirmed, false) then v_period_end
        else app_subscription_expires_at
      end,
      updated_at = now()
  where id = v_session.student_id
    and coach_id = v_session.coach_id;

  if v_status = 'active' and coalesce(p_is_confirmed, false) then
    v_commission_cents := round(v_affiliate.monthly_fee_cents * v_affiliate.commission_rate)::integer;

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
      provider_subscription_id,
      updated_at
    )
    values (
      p_event_id,
      v_session.coach_id,
      v_session.student_id,
      v_affiliate.email,
      'paid',
      v_event_at,
      date_trunc('month', v_event_at)::date,
      v_affiliate.monthly_fee_cents,
      p_provider_amount_cents,
      v_affiliate.commission_rate,
      v_commission_cents,
      'cartpanda',
      nullif(btrim(coalesce(p_provider_order_id, '')), ''),
      nullif(btrim(coalesce(p_provider_subscription_id, '')), ''),
      now()
    )
    on conflict do nothing;
  elsif v_status in ('refunded', 'chargeback') then
    update public.affiliate_student_payments
    set status = v_status,
        reversal_event_id = p_event_id,
        reversed_at = v_event_at,
        updated_at = now()
    where id = (
      select payments.id
      from public.affiliate_student_payments as payments
      where payments.coach_id = v_session.coach_id
        and payments.student_id = v_session.student_id
        and payments.status = 'paid'
        and (
          (
            nullif(btrim(coalesce(p_provider_order_id, '')), '') is not null
            and payments.provider_order_id = p_provider_order_id
          )
          or (
            nullif(btrim(coalesce(p_provider_order_id, '')), '') is null
            and nullif(btrim(coalesce(p_provider_subscription_id, '')), '') is not null
            and payments.provider_subscription_id = p_provider_subscription_id
          )
        )
      order by payments.paid_at desc
      limit 1
    );
  end if;

  update public.payment_webhook_events
  set subscription_status = v_status,
      processed = true,
      processing_error = null
  where event_id = p_event_id;

  return jsonb_build_object(
    'ok', true,
    'processed', true,
    'studentId', v_session.student_id,
    'coachId', v_session.coach_id,
    'status', v_status,
    'financialAccessOpen', public.coachfit_student_financial_access_by_invite((
      select invites.code
      from public.student_invites as invites
      where invites.student_id = v_session.student_id
        and invites.coach_id = v_session.coach_id
        and invites.status = 'active'
        and (invites.expires_at is null or invites.expires_at > now())
      order by invites.created_at desc
      limit 1
    ))
  );
end;
$$;

revoke all on function public.process_student_cartpanda_event(
  uuid, text, timestamptz, text, boolean, text, text, text, integer
) from public, anon, authenticated;

grant execute on function public.process_student_cartpanda_event(
  uuid, text, timestamptz, text, boolean, text, text, text, integer
) to service_role;

comment on function public.process_student_cartpanda_event(
  uuid, text, timestamptz, text, boolean, text, text, text, integer
) is 'Service-only atomic application of one student/patient CartPanda event.';

commit;
