create or replace function public.get_student_anamnesis(invite_code text)
returns setof public.student_anamneses
language sql
stable
security definer
set search_path = ''
as $$
  select anamneses.*
  from public.student_anamneses as anamneses
  join public.student_invites as invites
    on invites.student_id = anamneses.student_id
  where invites.code = btrim(invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc, anamneses.updated_at desc
  limit 1
$$;

revoke all on function public.get_student_anamnesis(text) from public;
grant execute on function public.get_student_anamnesis(text) to anon, authenticated;
