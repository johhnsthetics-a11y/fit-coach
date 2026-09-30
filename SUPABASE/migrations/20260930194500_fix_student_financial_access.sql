begin;

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
        (
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

commit;
