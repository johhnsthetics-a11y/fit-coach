begin;

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
  current_affiliate_email text;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;

  if start_date > end_date then
    raise exception 'A data inicial nao pode ser maior que a data final.' using errcode = '22007';
  end if;

  if (end_date - start_date) > 1095 then
    raise exception 'O periodo maximo permitido e de 3 anos.' using errcode = '22007';
  end if;

  select affiliates.email
  into current_affiliate_email
  from public.users as users
  join public.affiliate_professionals as affiliates
    on affiliates.email = lower(btrim(users.email))
   and affiliates.active = true
  where users.id = current_user_id
  limit 1;

  if current_affiliate_email is null then
    raise exception 'Relatorio de comissoes indisponivel para esta conta.' using errcode = '42501';
  end if;

  end_exclusive := (end_date + 1)::timestamptz;

  with period_payments as (
    select payments.*
    from public.affiliate_student_payments as payments
    where payments.coach_id = current_user_id
      and payments.affiliate_email = current_affiliate_email
      and payments.paid_at >= start_date::timestamptz
      and payments.paid_at < end_exclusive
      and payments.status = 'paid'
  ),
  client_rows as (
    select
      payments.student_id,
      coalesce(nullif(btrim(students.name), ''), 'Aluno/Paciente') as client_name,
      coalesce(students.email, '') as client_email,
      coalesce(students.app_payment_status, 'pending') as app_payment_status,
      count(*)::int as payment_count,
      coalesce(sum(payments.revenue_cents), 0)::int as revenue_cents,
      coalesce(sum(payments.commission_cents), 0)::int as commission_cents,
      max(payments.paid_at) as last_paid_at
    from period_payments as payments
    left join public.students as students
      on students.id = payments.student_id
     and students.coach_id = current_user_id
    group by payments.student_id, students.name, students.email, students.app_payment_status
  ),
  totals as (
    select
      count(distinct payments.student_id)::int as paid_clients,
      count(*)::int as paid_installments,
      coalesce(sum(payments.revenue_cents), 0)::int as revenue_cents,
      coalesce(sum(payments.commission_cents), 0)::int as commission_cents
    from period_payments as payments
  )
  select jsonb_build_object(
    'period', jsonb_build_object('startDate', start_date, 'endDate', end_date),
    'monthlyFeeCents', 2500,
    'commissionRate', 0.25,
    'commissionPerPaidInstallmentCents', 625,
    'totals', jsonb_build_object(
      'paidClients', totals.paid_clients,
      'paidInstallments', totals.paid_installments,
      'revenueCents', totals.revenue_cents,
      'commissionCents', totals.commission_cents
    ),
    'clients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'studentId', clients.student_id,
          'clientName', clients.client_name,
          'clientEmail', clients.client_email,
          'appPaymentStatus', clients.app_payment_status,
          'paymentCount', clients.payment_count,
          'revenueCents', clients.revenue_cents,
          'commissionCents', clients.commission_cents,
          'lastPaidAt', clients.last_paid_at
        )
        order by clients.commission_cents desc, clients.client_name asc
      )
      from client_rows as clients
    ), '[]'::jsonb)
  )
  into result
  from totals;

  return result;
end;
$$;

revoke all on function public.get_my_commission_report(date, date) from public, anon, authenticated;
grant execute on function public.get_my_commission_report(date, date) to authenticated;

commit;
