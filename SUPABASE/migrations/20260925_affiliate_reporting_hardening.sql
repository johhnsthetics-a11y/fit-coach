begin;

-- Mantém o relatório administrativo existente, mas faz os metadados comerciais
-- virem da configuração central do programa.
alter function public.get_affiliate_finance_report(date, date)
  rename to get_affiliate_finance_report_base;

revoke all on function public.get_affiliate_finance_report_base(date, date)
  from public, anon, authenticated;

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
  result jsonb;
  terms jsonb;
  monthly_fee integer;
  commission_rate numeric;
begin
  result := public.get_affiliate_finance_report_base(p_start_date, p_end_date);
  terms := public.coachfit_affiliate_program_terms();
  monthly_fee := coalesce((terms->>'monthlyFeeCents')::integer, 2500);
  commission_rate := coalesce((terms->>'commissionRate')::numeric, 0.25);

  result := jsonb_set(result, '{monthlyFeeCents}', to_jsonb(monthly_fee), true);
  result := jsonb_set(result, '{commissionRate}', to_jsonb(commission_rate), true);
  result := jsonb_set(
    result,
    '{commissionPerPaidInstallmentCents}',
    to_jsonb(round(monthly_fee * commission_rate)::integer),
    true
  );
  return result;
end;
$$;

revoke all on function public.get_affiliate_finance_report(date, date) from public, anon;
grant execute on function public.get_affiliate_finance_report(date, date) to authenticated;

-- Painel do próprio afiliado. Nunca recebe coach_id por parâmetro:
-- a identidade vem exclusivamente da sessão autenticada.
create or replace function public.get_my_affiliate_finance_report(
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
  current_email text;
  current_name text;
  current_role text;
  result jsonb;
  terms jsonb;
  monthly_fee integer;
  commission_rate numeric;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada.' using errcode = '42501';
  end if;

  if start_date > end_date then
    raise exception 'A data inicial não pode ser maior que a data final.' using errcode = '22007';
  end if;

  if (end_date - start_date) > 1095 then
    raise exception 'O período máximo permitido é de 3 anos.' using errcode = '22007';
  end if;

  select lower(btrim(users.email)), users.name, lower(coalesce(users.role, ''))
  into current_email, current_name, current_role
  from public.users as users
  where users.id = auth.uid()
  limit 1;

  if current_email is null or not exists (
    select 1
    from public.affiliate_professionals as affiliates
    where affiliates.email = current_email
      and affiliates.active = true
  ) then
    raise exception 'Conta não habilitada como afiliado.' using errcode = '42501';
  end if;

  end_exclusive := (end_date + 1)::timestamptz;
  terms := public.coachfit_affiliate_program_terms();
  monthly_fee := coalesce((terms->>'monthlyFeeCents')::integer, 2500);
  commission_rate := coalesce((terms->>'commissionRate')::numeric, 0.25);

  select jsonb_build_object(
    'period', jsonb_build_object('startDate', start_date, 'endDate', end_date),
    'professionalName', coalesce(nullif(btrim(current_name), ''), current_email),
    'professionalType', case when current_role like '%nutri%' then 'nutritionist' else 'trainer' end,
    'monthlyFeeCents', monthly_fee,
    'commissionRate', commission_rate,
    'commissionPerPaidInstallmentCents', round(monthly_fee * commission_rate)::integer,
    'studentsBrought', (
      select count(*)::int
      from public.students as students
      where students.coach_id = auth.uid()
    ),
    'newStudentsInPeriod', (
      select count(*)::int
      from public.students as students
      where students.coach_id = auth.uid()
        and students.created_at >= start_date::timestamptz
        and students.created_at < end_exclusive
    ),
    'paidStudents', (
      select count(distinct payments.student_id)::int
      from public.affiliate_student_payments as payments
      where payments.coach_id = auth.uid()
        and payments.affiliate_email = current_email
        and payments.paid_at >= start_date::timestamptz
        and payments.paid_at < end_exclusive
        and payments.status = 'paid'
    ),
    'paidInstallments', (
      select count(*)::int
      from public.affiliate_student_payments as payments
      where payments.coach_id = auth.uid()
        and payments.affiliate_email = current_email
        and payments.paid_at >= start_date::timestamptz
        and payments.paid_at < end_exclusive
        and payments.status = 'paid'
    ),
    'revenueCents', (
      select coalesce(sum(payments.revenue_cents), 0)::int
      from public.affiliate_student_payments as payments
      where payments.coach_id = auth.uid()
        and payments.affiliate_email = current_email
        and payments.paid_at >= start_date::timestamptz
        and payments.paid_at < end_exclusive
        and payments.status = 'paid'
    ),
    'commissionCents', (
      select coalesce(sum(payments.commission_cents), 0)::int
      from public.affiliate_student_payments as payments
      where payments.coach_id = auth.uid()
        and payments.affiliate_email = current_email
        and payments.paid_at >= start_date::timestamptz
        and payments.paid_at < end_exclusive
        and payments.status = 'paid'
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
        and payments.paid_at >= start_date::timestamptz
        and payments.paid_at < end_exclusive
        and payments.status = 'paid'
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_my_affiliate_finance_report(date, date) from public, anon;
grant execute on function public.get_my_affiliate_finance_report(date, date) to authenticated;

commit;
