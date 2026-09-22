create or replace function public.get_student_portal(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  portal jsonb;
  access_open boolean;
  professional_type text;
  professional_name text;
begin
  portal := public.get_student_portal_unchecked(invite_code);
  if portal is null then
    return null;
  end if;

  select
    case
      when lower(coalesce(users.role, '')) like '%nutri%' then 'nutritionist'
      else 'trainer'
    end,
    nullif(btrim(users.name), '')
  into professional_type, professional_name
  from public.student_invites as invites
  join public.users as users on users.id = invites.coach_id
  where invites.code = trim(invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  access_open := public.coachfit_student_financial_access_by_invite(invite_code);
  if access_open then
    return portal || jsonb_build_object(
      'financial_access_open', true,
      'professional_type', coalesce(professional_type, 'trainer'),
      'professional_name', coalesce(professional_name, '')
    );
  end if;

  return portal || jsonb_build_object(
    'financial_access_open', false,
    'professional_type', coalesce(professional_type, 'trainer'),
    'professional_name', coalesce(professional_name, ''),
    'checkins', '[]'::jsonb,
    'workouts', '[]'::jsonb,
    'nutrition_plans', '[]'::jsonb,
    'workout_logs', '[]'::jsonb,
    'appointments', '[]'::jsonb,
    'assessments', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_student_portal(text) from public;
grant execute on function public.get_student_portal(text) to anon, authenticated;

