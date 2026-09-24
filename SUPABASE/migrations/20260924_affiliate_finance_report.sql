begin;

create or replace function public.get_affiliate_finance_report(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  start_date date := coalesce(p_start_date, date_trunc('month', current_date)::date);
  end_date date := coalesce(p_end_date, current_date);
  end_exclusive timestamptz;
  result jsonb;
begin
  if start_date > end_date then
    raise exception 'A data inicial não pode ser maior que a data final.' using errcode = '22007';
  end if;

  if (end_date - start_date) > 1095 then
    raise exception 'O período máximo permitido é de 3 anos.' using errcode = '22007';
  end if;

  if auth.uid() is null
     or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'sac@coachfitpro.com.br' then
    raise exception 'Acesso exclusivo do Admin Master.' using errcode = '42501';
  end if;

  end_exclusive := (end_date + 1)::timestamptz;

  with affiliate_keys as (
    select affiliates.email, affiliates.active
    from public.affiliate_professionals as affiliates

    union

    select payments.affiliate_email as email, false as active
    from public.affiliate_student_payments as payments
    where payments.paid_at >= start_date::timestamptz
      and payments.paid_at < end_exclusive
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
        select count(*)::int
        from public.students as students
        where students.coach_id = users.id
          and students.created_at >= start_date::timestamptz
          and students.created_at < end_exclusive
      ) as new_students_in_period,
      (
        select count(distinct payments.student_id)::int
        from public.affiliate_student_payments as payments
        where payments.affiliate_email = keys.email
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
          and payments.status = 'paid'
      ) as paid_students,
      (
        select count(*)::int
        from public.affiliate_student_payments as payments
        where payments.affiliate_email = keys.email
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
          and payments.status = 'paid'
      ) as paid_installments,
      (
        select coalesce(sum(payments.revenue_cents), 0)::int
        from public.affiliate_student_payments as payments
        where payments.affiliate_email = keys.email
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
          and payments.status = 'paid'
      ) as revenue_cents,
      (
        select coalesce(sum(payments.commission_cents), 0)::int
        from public.affiliate_student_payments as payments
        where payments.affiliate_email = keys.email
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
          and payments.status = 'paid'
      ) as commission_cents,
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
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
          )
          order by payments.paid_at desc
        ), '[]'::jsonb)
        from public.affiliate_student_payments as payments
        left join public.students as students on students.id = payments.student_id
        where payments.affiliate_email = keys.email
          and payments.paid_at >= start_date::timestamptz
          and payments.paid_at < end_exclusive
          and payments.status = 'paid'
      ) as sales
    from affiliate_keys as keys
    left join public.users as users
      on lower(btrim(users.email)) = keys.email
  ),
  totals as (
    select
      count(*)::int as affiliate_count,
      coalesce(sum(rows.students_brought), 0)::int as students_brought,
      coalesce(sum(rows.new_students_in_period), 0)::int as new_students_in_period,
      coalesce(sum(rows.paid_students), 0)::int as paid_students,
      coalesce(sum(rows.paid_installments), 0)::int as paid_installments,
      coalesce(sum(rows.revenue_cents), 0)::int as revenue_cents,
      coalesce(sum(rows.commission_cents), 0)::int as commission_cents
    from affiliate_rows as rows
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'startDate', start_date,
      'endDate', end_date
    ),
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
    'affiliates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
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
          'sales', rows.sales
        )
        order by rows.commission_cents desc, rows.professional_name asc
      )
      from affiliate_rows as rows
    ), '[]'::jsonb)
  )
  into result
  from totals;

  return coalesce(result, jsonb_build_object(
    'period', jsonb_build_object('startDate', start_date, 'endDate', end_date),
    'monthlyFeeCents', 2500,
    'commissionRate', 0.25,
    'commissionPerPaidInstallmentCents', 625,
    'totals', jsonb_build_object(
      'affiliateCount', 0,
      'studentsBrought', 0,
      'newStudentsInPeriod', 0,
      'paidStudents', 0,
      'paidInstallments', 0,
      'revenueCents', 0,
      'commissionCents', 0
    ),
    'affiliates', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.get_affiliate_finance_report(date, date) from public, anon;
grant execute on function public.get_affiliate_finance_report(date, date) to authenticated;

commit;
