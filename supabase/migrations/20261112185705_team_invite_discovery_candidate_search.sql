-- Keep invitation lookup private to the authenticated recipient's exact address.
-- The inbox does not filter by role so an address-matched pending invitation is
-- visible and diagnosable even if a legacy profile role differs. Acceptance
-- still enforces the invited role in accept_professional_team_invite().
create or replace function public.get_professional_team_invite_inbox()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
begin
  if actor_id is null or private.coachfit_professional_role(actor_id) is null then
    raise exception 'Conta profissional não identificada.' using errcode = '42501';
  end if;

  select lower(btrim(email)) into actor_email
  from auth.users
  where id = actor_id;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id,
      'teamId', i.team_id,
      'teamName', t.name,
      'ownerName', owner_user.name,
      'ownerProfessionalId', t.owner_professional_id,
      'senderId', i.invited_by,
      'direction', 'incoming',
      'inviteeEmail', i.invitee_email,
      'recipientEmail', i.invitee_email,
      'professionalRole', i.expected_role,
      'expectedRole', i.expected_role,
      'selectedStudentIds', to_jsonb(i.selected_student_ids),
      'selectedStudentCount', cardinality(i.selected_student_ids),
      'selectedPatients', coalesce((
        select jsonb_agg(jsonb_build_object('id', selected.student_id, 'name', s.name) order by s.name)
        from unnest(i.selected_student_ids) as selected(student_id)
        join public.students s on s.id = selected.student_id and s.coach_id = t.owner_professional_id
      ), '[]'::jsonb),
      'status', i.status,
      'createdAt', i.created_at,
      'expiresAt', i.expires_at
    ) order by i.created_at desc)
    from public.professional_team_invites i
    join public.professional_teams t on t.id = i.team_id
    join public.users owner_user on owner_user.id = t.owner_professional_id
    where lower(btrim(i.invitee_email)) = actor_email
      and i.status = 'pending'
      and i.expires_at > now()
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_professional_team_invite_inbox() from public, anon;
grant execute on function public.get_professional_team_invite_inbox() to authenticated;

-- Search operates only on the authenticated professional's own roster.
create or replace function public.list_professional_team_candidates()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or private.coachfit_professional_role(actor_id) is null then
    raise exception 'Conta profissional não identificada.' using errcode = '42501';
  end if;
  perform private.coachfit_require_professional_access();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'email', coalesce(s.email, ''),
      'cpf', coalesce(s.cpf, ''),
      'goal', s.goal
    ) order by s.name)
    from public.students s
    where s.coach_id = actor_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_professional_team_candidates() from public, anon;
grant execute on function public.list_professional_team_candidates() to authenticated;
