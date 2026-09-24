begin;

create or replace function public.coachfit_current_professional_is_affiliate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.affiliate_professionals as affiliates
      where affiliates.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
        and affiliates.active = true
    );
$$;

revoke all on function public.coachfit_current_professional_is_affiliate() from public, anon;
grant execute on function public.coachfit_current_professional_is_affiliate() to authenticated;

commit;
