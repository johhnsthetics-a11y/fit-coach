-- BUILD44: expose only the minimum invitation context needed to prefill the signup form.
-- The invitation UUID is the lookup key; no patient list or clinical data is returned.
create or replace function public.get_professional_team_invite_signup_context(selected_invite_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'inviteId', i.id,
    'inviteeEmail', lower(btrim(i.invitee_email)),
    'professionalRole', i.expected_role,
    'teamName', t.name,
    'expiresAt', i.expires_at
  )
  from public.professional_team_invites i
  join public.professional_teams t on t.id = i.team_id
  where i.id = selected_invite_id
    and i.status = 'pending'
    and i.expires_at > now()
    and i.expected_role in ('trainer', 'nutritionist')
    and cardinality(coalesce(i.selected_student_ids, array[]::uuid[])) > 0
    and not exists (
      select 1
      from unnest(coalesce(i.selected_student_ids, array[]::uuid[])) as selected(student_id)
      where not exists (
        select 1
        from public.students s
        where s.id = selected.student_id
          and s.coach_id = t.owner_professional_id
      )
    )
  limit 1;
$$;

revoke all on function public.get_professional_team_invite_signup_context(uuid) from public, anon, authenticated;
grant execute on function public.get_professional_team_invite_signup_context(uuid) to anon, authenticated;
