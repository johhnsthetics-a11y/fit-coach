begin;

drop policy if exists "affiliate_professionals_self_select" on public.affiliate_professionals;
create policy "affiliate_professionals_self_select"
on public.affiliate_professionals
for select
to authenticated
using (
  affiliate_professionals.active = true
  and affiliate_professionals.email = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "affiliate_student_payments_owner_select" on public.affiliate_student_payments;
create policy "affiliate_student_payments_owner_select"
on public.affiliate_student_payments
for select
to authenticated
using (
  affiliate_student_payments.coach_id = auth.uid()
  and affiliate_student_payments.affiliate_email = lower(coalesce(auth.jwt() ->> 'email', ''))
);

alter function public.get_my_commission_report(date, date) security invoker;

commit;
