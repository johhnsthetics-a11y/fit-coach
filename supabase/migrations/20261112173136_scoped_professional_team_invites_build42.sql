-- BUILD41 collaboration follow-up: private, scoped email invitations with access active on acceptance.
-- Each invitation is tied to one normalized email and carries owner-selected patients for one professional role.
-- Existing subscriptions stay attached to the invitee's own account; collaboration grants do not change billing.

alter table public.professional_team_invites
  add column if not exists selected_student_ids uuid[] not null default array[]::uuid[];
alter table public.professional_patient_delegations
  add column if not exists authorization_source text not null default 'patient';

-- Previously selected pending delegations were explicitly chosen by the team owner.
-- Activate those owner-authorized scopes without asking the patient to approve the same plan twice.
update public.professional_patient_delegations d
set consent_status = 'accepted', consent_version = '2026-11-12-owner-authorized-v1',
    authorization_source = 'team_owner', requested_by = d.owner_professional_id,
    accepted_by = null, accepted_at = now(), updated_at = now()
from public.professional_team_members m
where m.team_id = d.team_id and m.member_professional_id = d.member_professional_id and m.status = 'active'
  and d.status = 'active' and d.consent_status = 'pending'
  and ((d.area = 'workout' and m.professional_role = 'trainer')
    or (d.area = 'nutrition' and m.professional_role = 'nutritionist'));

create or replace function public.create_professional_team_invite_scoped(
  selected_team_id uuid,
  invitee_email text,
  expected_professional_role text,
  selected_student_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  team_row public.professional_teams%rowtype;
  invitee_auth_id uuid;
  invitee_role text;
  saved public.professional_team_invites%rowtype;
  normalized_email text := lower(btrim(coalesce(invitee_email, '')));
  normalized_role text := lower(btrim(coalesce(expected_professional_role, '')));
  requested_ids uuid[] := coalesce(selected_student_ids, array[]::uuid[]);
  area_value text;
begin
  if actor_id is null then raise exception 'Sessão profissional não identificada.' using errcode = '42501'; end if;
  perform private.coachfit_require_professional_access();
  select lower(email) into actor_email from auth.users where id = actor_id;
  select * into team_row from public.professional_teams where id = selected_team_id and owner_professional_id = actor_id;
  if not found then raise exception 'Somente o responsável pode convidar membros para esta equipe.' using errcode = '42501'; end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  if normalized_role not in ('trainer', 'nutritionist') then raise exception 'O papel do profissional convidado é inválido.' using errcode = '22023'; end if;
  if normalized_email = actor_email then raise exception 'Você não pode convidar sua própria conta para a equipe.' using errcode = '22023'; end if;

  requested_ids := coalesce((select array_agg(distinct item) from unnest(requested_ids) as ids(item)), array[]::uuid[]);
  if cardinality(requested_ids) = 0 then raise exception 'Selecione ao menos um paciente para incluir no convite.' using errcode = '22023'; end if;
  if exists (
    select 1 from unnest(requested_ids) as selected(student_id)
    where not exists (select 1 from public.students s where s.id = selected.student_id and s.coach_id = actor_id)
  ) then raise exception 'Um ou mais pacientes selecionados não pertencem à sua carteira.' using errcode = '42501'; end if;

  select id into invitee_auth_id from auth.users where lower(email) = normalized_email limit 1;
  if invitee_auth_id is not null then
    invitee_role := private.coachfit_professional_role(invitee_auth_id);
    if invitee_role is distinct from normalized_role then
      raise exception 'Este e-mail já tem uma conta Coach Fit Pro com outro perfil. Convide o e-mail da conta profissional de treinador/nutricionista selecionada.' using errcode = '22023';
    end if;
    if exists (select 1 from public.professional_team_members m where m.team_id = selected_team_id and m.member_professional_id = invitee_auth_id and m.status = 'active') then
      raise exception 'Este profissional já participa desta equipe.' using errcode = '23505';
    end if;
  elsif exists (select 1 from public.users u where lower(u.email) = normalized_email) then
    raise exception 'O cadastro deste e-mail está incompleto. Peça ao profissional para acessar a conta e concluir o perfil antes do convite.' using errcode = '22023';
  end if;

  update public.professional_team_invites as existing
  set status = 'cancelled'
  where existing.team_id = selected_team_id and lower(existing.invitee_email) = normalized_email and existing.status = 'pending';

  insert into public.professional_team_invites (team_id, invited_by, invitee_email, expected_role, status, expires_at, selected_student_ids)
  values (selected_team_id, actor_id, normalized_email, normalized_role, 'pending', now() + interval '14 days', requested_ids)
  returning * into saved;

  if invitee_auth_id is not null and to_regclass('public.notifications') is not null then
    insert into public.notifications (user_id, title, body)
    values (invitee_auth_id, 'Convite para equipe profissional', 'Há um convite enviado para este e-mail. Confira a área Equipe no Coach Fit Pro.');
  end if;

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, action, details)
  values (selected_team_id, actor_id, actor_id, invitee_auth_id, 'member_invited',
    jsonb_build_object('email', normalized_email, 'expectedRole', normalized_role, 'inviteId', saved.id,
      'area', case normalized_role when 'trainer' then 'workout' else 'nutrition' end, 'selectedStudentIds', requested_ids));

  return jsonb_build_object('id', saved.id, 'teamId', saved.team_id, 'inviteeEmail', saved.invitee_email,
    'expectedRole', saved.expected_role, 'selectedStudentIds', to_jsonb(saved.selected_student_ids),
    'selectedStudentCount', cardinality(saved.selected_student_ids), 'status', saved.status, 'expiresAt', saved.expires_at,
    'inviteeHasAccount', invitee_auth_id is not null);
end;
$$;

create or replace function public.get_professional_team_invite_email_payload(selected_invite_id uuid, caller_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  invite_row public.professional_team_invites%rowtype;
  team_row public.professional_teams%rowtype;
  inviter public.users%rowtype;
  recipient_has_auth boolean;
  recipient_has_profile boolean;
begin
  if caller_id is null then raise exception 'Conta responsável não identificada.' using errcode = '42501'; end if;
  select * into invite_row from public.professional_team_invites
  where id = selected_invite_id and invited_by = caller_id and status = 'pending' and expires_at > now();
  if not found then raise exception 'Convite pendente não encontrado para esta conta.' using errcode = '42501'; end if;
  select * into team_row from public.professional_teams where id = invite_row.team_id and owner_professional_id = caller_id;
  if not found then raise exception 'Somente o responsável pode enviar este convite.' using errcode = '42501'; end if;
  select * into inviter from public.users where id = caller_id;
  select exists(select 1 from auth.users where lower(email) = lower(invite_row.invitee_email)) into recipient_has_auth;
  select exists(select 1 from public.users where lower(email) = lower(invite_row.invitee_email)) into recipient_has_profile;
  return jsonb_build_object('inviteId', invite_row.id, 'email', invite_row.invitee_email,
    'role', invite_row.expected_role, 'teamName', team_row.name, 'inviterName', coalesce(inviter.name, 'Profissional'),
    'patientCount', cardinality(invite_row.selected_student_ids), 'area', case invite_row.expected_role when 'trainer' then 'Treinos' else 'Nutrição' end,
    'hasAccount', recipient_has_auth and recipient_has_profile);
end;
$$;

-- The public sign-up screen uses this boolean-only preflight to allow account creation
-- without a subscription only for the exact invited email and role.
create or replace function public.validate_professional_team_invite_signup(
  selected_invite_id uuid,
  signup_email text,
  signup_professional_role text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.professional_team_invites i
    where i.id = selected_invite_id
      and lower(i.invitee_email) = lower(btrim(coalesce(signup_email, '')))
      and i.expected_role = lower(btrim(coalesce(signup_professional_role, '')))
      and i.status = 'pending'
      and i.expires_at > now()
      and cardinality(i.selected_student_ids) > 0
  );
$$;


create or replace function public.get_professional_team_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  result jsonb;
begin
  if actor_id is null or private.coachfit_professional_role(actor_id) is null then
    raise exception 'Conta profissional não identificada.' using errcode = '42501';
  end if;
  select lower(email) into actor_email from auth.users where id = actor_id;

  select jsonb_build_object(
    'teams', coalesce((
      select jsonb_agg(team_view.value order by team_view.created_at desc)
      from (
        select t.created_at,
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'ownerProfessionalId', t.owner_professional_id,
            'ownerName', coalesce(owner_user.name, 'Profissional'),
            'isOwner', t.owner_professional_id = actor_id,
            'createdAt', t.created_at,
            'members', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', m.member_professional_id,
                'name', coalesce(member_user.name, 'Profissional'),
                'role', m.professional_role,
                'status', m.status,
                'acceptedAt', m.accepted_at
              ) order by member_user.name)
              from public.professional_team_members m
              join public.users member_user on member_user.id = m.member_professional_id
              where m.team_id = t.id and m.status = 'active'
            ), '[]'::jsonb),
            'invites', case when t.owner_professional_id = actor_id then coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', i.id,
                'email', i.invitee_email,
                'inviteeEmail', i.invitee_email,
                'recipientEmail', i.invitee_email,
                'role', i.expected_role,
                'professionalRole', i.expected_role,
                'expectedRole', i.expected_role,
                'selectedStudentIds', to_jsonb(i.selected_student_ids),
                'selectedStudentCount', cardinality(i.selected_student_ids),
                'selectedPatients', coalesce((select jsonb_agg(jsonb_build_object('id', selected.student_id, 'name', s.name) order by s.name) from unnest(i.selected_student_ids) as selected(student_id) join public.students s on s.id = selected.student_id and s.coach_id = t.owner_professional_id), '[]'::jsonb),
                'direction', 'outgoing',
                'senderId', i.invited_by,
                'status', i.status,
                'createdAt', i.created_at,
                'expiresAt', i.expires_at
              ) order by i.created_at desc)
              from public.professional_team_invites i
              where i.team_id = t.id and i.status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')
                and i.created_at >= now() - interval '90 days'
            ), '[]'::jsonb) else '[]'::jsonb end,
            'delegations', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', d.id,
                'memberId', d.member_professional_id,
                'memberName', coalesce(delegate_user.name, 'Profissional'),
                'area', d.area,
                'studentId', d.student_id,
                'studentName', coalesce(students.name, 'Paciente'),
                'status', d.status,
                'consentStatus', d.consent_status,
                'requestedAt', d.requested_at,
                'acceptedAt', d.accepted_at
              ) order by d.created_at desc)
              from public.professional_patient_delegations d
              join public.professional_team_members member_row
                on member_row.team_id = d.team_id and member_row.member_professional_id = d.member_professional_id
              join public.users delegate_user on delegate_user.id = d.member_professional_id
              join public.students on students.id = d.student_id and students.coach_id = d.owner_professional_id
              where d.team_id = t.id
                and (
                  t.owner_professional_id = actor_id
                  or (d.member_professional_id = actor_id and d.status = 'active' and d.consent_status = 'accepted' and member_row.status = 'active')
                )
            ), '[]'::jsonb)
          ) as value
        from public.professional_teams t
        join public.users owner_user on owner_user.id = t.owner_professional_id
        where t.owner_professional_id = actor_id
           or exists (
             select 1 from public.professional_team_members m
             where m.team_id = t.id and m.member_professional_id = actor_id and m.status = 'active'
           )
      ) team_view
    ), '[]'::jsonb),
    'pendingInvites', coalesce((
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
        'selectedPatients', coalesce((select jsonb_agg(jsonb_build_object('id', selected.student_id, 'name', s.name) order by s.name) from unnest(i.selected_student_ids) as selected(student_id) join public.students s on s.id = selected.student_id and s.coach_id = t.owner_professional_id), '[]'::jsonb),
        'createdAt', i.created_at,
        'expiresAt', i.expires_at
      ) order by i.created_at desc)
      from public.professional_team_invites i
      join public.professional_teams t on t.id = i.team_id
      join public.users owner_user on owner_user.id = t.owner_professional_id
      where lower(i.invitee_email) = actor_email and i.status = 'pending' and i.expires_at > now()
        and i.expected_role = private.coachfit_professional_role(actor_id)
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.accept_professional_team_invite(selected_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  actor_role text;
  invite_row public.professional_team_invites%rowtype;
  team_row public.professional_teams%rowtype;
begin
  if actor_id is null then raise exception 'Sessão profissional não identificada.' using errcode = '42501'; end if;
  select lower(email) into actor_email from auth.users where id = actor_id;
  actor_role := private.coachfit_professional_role(actor_id);
  select * into invite_row from public.professional_team_invites where id = selected_invite_id for update;
  if not found or invite_row.status <> 'pending' or invite_row.expires_at <= now()
     or lower(invite_row.invitee_email) is distinct from actor_email
     or invite_row.expected_role is distinct from actor_role then
    raise exception 'Convite não encontrado, expirado ou destinado a outra conta.' using errcode = '42501';
  end if;
  select * into team_row from public.professional_teams where id = invite_row.team_id;
  if not found then raise exception 'A equipe deste convite não está mais disponível.' using errcode = '42501'; end if;
  if team_row.owner_professional_id = actor_id then raise exception 'Responsável e membro não podem ser a mesma conta.' using errcode = '22023'; end if;
  if coalesce(cardinality(invite_row.selected_student_ids), 0) = 0 then
    raise exception 'Este convite não contém pacientes selecionados. Solicite ao responsável que envie um novo convite.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(invite_row.selected_student_ids) as selected(student_id)
    where not exists (select 1 from public.students s where s.id = selected.student_id and s.coach_id = team_row.owner_professional_id)
  ) then
    raise exception 'Um paciente selecionado não pertence mais ao responsável da equipe.' using errcode = '42501';
  end if;

  insert into public.professional_team_members (team_id, member_professional_id, professional_role, status, invited_by, accepted_at, updated_at)
  values (invite_row.team_id, actor_id, actor_role, 'active', invite_row.invited_by, now(), now())
  on conflict (team_id, member_professional_id) do update
    set professional_role = excluded.professional_role, status = 'active', invited_by = excluded.invited_by,
        accepted_at = now(), updated_at = now();

  update public.professional_team_invites
  set status = 'accepted', accepted_by = actor_id, accepted_at = now()
  where id = selected_invite_id;

  insert into public.professional_patient_delegations (
    team_id, owner_professional_id, member_professional_id, student_id, area, status, consent_status,
    consent_version, authorization_source, requested_by, requested_at, accepted_by, accepted_at, updated_at
  )
  select invite_row.team_id, team_row.owner_professional_id, actor_id, selected.student_id,
    case invite_row.expected_role when 'trainer' then 'workout' else 'nutrition' end,
    'active', 'accepted', '2026-11-12-owner-authorized-v1', 'team_owner', invite_row.invited_by,
    now(), null, now(), now()
  from unnest(invite_row.selected_student_ids) as selected(student_id)
  on conflict (team_id, member_professional_id, student_id, area) do update
    set status = 'active', consent_status = 'accepted', consent_version = '2026-11-12-owner-authorized-v1',
        authorization_source = 'team_owner', requested_by = invite_row.invited_by,
        requested_at = now(), accepted_by = null, accepted_at = now(), revoked_at = null, updated_at = now();

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, action, details)
  values (invite_row.team_id, team_row.owner_professional_id, actor_id, actor_id, 'selected_access_enabled_on_invite_accept',
    jsonb_build_object('inviteId', selected_invite_id, 'area', case invite_row.expected_role when 'trainer' then 'workout' else 'nutrition' end,
      'patientCount', cardinality(invite_row.selected_student_ids)));

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, action, details)
  values (invite_row.team_id, team_row.owner_professional_id, actor_id, actor_id, 'member_accepted_invite', jsonb_build_object('inviteId', selected_invite_id));

  return jsonb_build_object('teamId', invite_row.team_id, 'status', 'active');
end;
$$;

create or replace function public.replace_professional_patient_delegations(
  selected_team_id uuid,
  selected_member_id uuid,
  selected_area text,
  selected_student_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  team_row public.professional_teams%rowtype;
  member_row public.professional_team_members%rowtype;
  requested_ids uuid[] := coalesce(selected_student_ids, array[]::uuid[]);
  current_student_id uuid;
  saved public.professional_patient_delegations%rowtype;
  previous_status text;
  previous_consent_status text;
begin
  perform private.coachfit_require_professional_access();
  select * into team_row from public.professional_teams where id = selected_team_id and owner_professional_id = actor_id;
  if not found then raise exception 'Somente o responsável da equipe pode liberar pacientes.' using errcode = '42501'; end if;
  if selected_area not in ('nutrition', 'workout') then raise exception 'Área de colaboração inválida.' using errcode = '22023'; end if;
  select * into member_row from public.professional_team_members
   where team_id = selected_team_id and member_professional_id = selected_member_id and status = 'active';
  if not found then raise exception 'O colaborador não está ativo nesta equipe.' using errcode = '42501'; end if;
  if (selected_area = 'nutrition' and member_row.professional_role <> 'nutritionist')
    or (selected_area = 'workout' and member_row.professional_role <> 'trainer') then
    raise exception 'A área selecionada não corresponde ao papel profissional do colaborador.' using errcode = '42501';
  end if;

  requested_ids := coalesce((select array_agg(distinct item) from unnest(requested_ids) as values_list(item)), array[]::uuid[]);
  if exists (
    select 1 from unnest(requested_ids) as requested(student_id)
    where not exists (select 1 from public.students s where s.id = requested.student_id and s.coach_id = actor_id)
  ) then
    raise exception 'Um ou mais pacientes não pertencem à carteira do responsável.' using errcode = '42501';
  end if;

  for current_student_id in
    select d.student_id
    from public.professional_patient_delegations d
    where d.team_id = selected_team_id and d.member_professional_id = selected_member_id
      and d.area = selected_area and d.status = 'active'
      and not (d.student_id = any(requested_ids))
  loop
    update public.professional_patient_delegations
    set status = 'revoked', consent_status = 'revoked', revoked_at = now(), updated_at = now()
    where team_id = selected_team_id and member_professional_id = selected_member_id and area = selected_area and student_id = current_student_id;
    insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, student_id, area, action)
    values (selected_team_id, actor_id, actor_id, selected_member_id, current_student_id, selected_area, 'patient_delegation_revoked_by_owner');
  end loop;

  foreach current_student_id in array requested_ids loop
    previous_status := null;
    previous_consent_status := null;
    select d.status, d.consent_status into previous_status, previous_consent_status
    from public.professional_patient_delegations d
    where d.team_id = selected_team_id and d.member_professional_id = selected_member_id
      and d.student_id = current_student_id and d.area = selected_area;

    insert into public.professional_patient_delegations (
      team_id, owner_professional_id, member_professional_id, student_id, area, status, consent_status,
      consent_version, authorization_source, requested_by, requested_at, accepted_by, accepted_at, revoked_at, updated_at
    ) values (
      selected_team_id, actor_id, selected_member_id, current_student_id, selected_area, 'active', 'accepted',
      '2026-11-12-owner-authorized-v1', 'team_owner', actor_id, now(), null, now(), null, now()
    )
    on conflict (team_id, member_professional_id, student_id, area) do update
      set status = 'active', consent_status = 'accepted', consent_version = '2026-11-12-owner-authorized-v1',
          authorization_source = 'team_owner', requested_by = actor_id, requested_at = now(), accepted_by = null,
          accepted_at = now(), revoked_at = null, updated_at = now()
    returning * into saved;

    if previous_status is distinct from 'active' or previous_consent_status is distinct from 'accepted' then
      insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, student_id, delegation_id, area, action)
      values (selected_team_id, actor_id, actor_id, selected_member_id, current_student_id, saved.id, selected_area, 'patient_access_authorized_by_owner');
    end if;
  end loop;

  return public.get_professional_team_workspace();
end;
$$;

create or replace function public.get_current_student_collaboration_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'Entre na conta do aluno para revisar autorizações.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'delegationId', d.id,
      'area', d.area,
      'teamName', t.name,
      'ownerName', coalesce(owner_user.name, 'Profissional responsável'),
      'professionalId', member_user.id,
      'professionalName', coalesce(member_user.name, 'Profissional'),
      'professionalRole', m.professional_role,
      'requestedAt', d.requested_at,
      'consentStatus', d.consent_status,
      'consentVersion', d.consent_version,
      'authorizationSource', d.authorization_source
    ) order by d.requested_at desc)
    from public.students s
    join public.professional_patient_delegations d on d.student_id = s.id and d.owner_professional_id = s.coach_id
    join public.professional_teams t on t.id = d.team_id and t.owner_professional_id = d.owner_professional_id
    join public.professional_team_members m on m.team_id = d.team_id and m.member_professional_id = d.member_professional_id and m.status = 'active'
    join public.users owner_user on owner_user.id = d.owner_professional_id
    join public.users member_user on member_user.id = d.member_professional_id
    where s.auth_user_id = actor_id and d.status = 'active' and d.consent_status in ('pending', 'accepted')
      and private.coachfit_professional_role(d.member_professional_id) = case d.area when 'nutrition' then 'nutritionist' when 'workout' then 'trainer' else null end
  ), '[]'::jsonb);
end;
$$;

create or replace function public.respond_to_professional_collaboration(selected_delegation_id uuid, decision text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  delegation_row public.professional_patient_delegations%rowtype;
  student_owner_id uuid;
  normalized_decision text;
  consent_status_value text;
begin
  normalized_decision := lower(btrim(coalesce(decision, '')));
  if actor_id is null then raise exception 'Entre na conta do aluno para autorizar um profissional.' using errcode = '42501'; end if;
  if normalized_decision not in ('accept', 'decline', 'revoke') then raise exception 'Decisão inválida.' using errcode = '22023'; end if;

  select d.* into delegation_row
  from public.professional_patient_delegations d
  join public.students s on s.id = d.student_id and s.auth_user_id = actor_id and s.coach_id = d.owner_professional_id
  join public.professional_teams t on t.id = d.team_id and t.owner_professional_id = d.owner_professional_id
  join public.professional_team_members m on m.team_id = d.team_id and m.member_professional_id = d.member_professional_id and m.status = 'active'
  where d.id = selected_delegation_id and d.status = 'active'
  for update of d;
  if not found then raise exception 'Solicitação indisponível ou não associada à sua conta.' using errcode = '42501'; end if;
  select coach_id into student_owner_id from public.students where id = delegation_row.student_id;

  if normalized_decision = 'accept' and delegation_row.consent_status <> 'pending' then
    raise exception 'Esta solicitação já foi respondida.' using errcode = '22023';
  end if;
  if normalized_decision = 'revoke' and delegation_row.consent_status <> 'accepted' then
    raise exception 'Não existe uma autorização ativa para revogar.' using errcode = '22023';
  end if;

  consent_status_value := case normalized_decision when 'accept' then 'accepted' when 'decline' then 'declined' else 'revoked' end;
  update public.professional_patient_delegations
  set consent_status = consent_status_value,
      accepted_by = case when normalized_decision = 'accept' then actor_id else null end,
      accepted_at = case when normalized_decision = 'accept' then now() else null end,
      updated_at = now()
  where id = selected_delegation_id
  returning * into delegation_row;

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, student_id, delegation_id, area, action, details)
  values (delegation_row.team_id, student_owner_id, actor_id, delegation_row.member_professional_id, delegation_row.student_id, delegation_row.id, delegation_row.area,
    case normalized_decision when 'accept' then 'patient_consent_accepted' when 'decline' then 'patient_consent_declined' else 'patient_consent_revoked' end,
    jsonb_build_object('consentVersion', delegation_row.consent_version));

  return jsonb_build_object('delegationId', delegation_row.id, 'status', delegation_row.status, 'consentStatus', delegation_row.consent_status);
end;
$$;


-- Reject stale clients that try to send an invitation without explicitly choosing patients.
drop function if exists public.create_professional_team_invite(uuid, text, text);
revoke all on function public.create_professional_team_invite_scoped(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.create_professional_team_invite_scoped(uuid, text, text, uuid[]) to authenticated;
revoke all on function public.get_professional_team_invite_email_payload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_professional_team_invite_email_payload(uuid, uuid) to service_role;
revoke all on function public.validate_professional_team_invite_signup(uuid, text, text) from public;
grant execute on function public.validate_professional_team_invite_signup(uuid, text, text) to anon, authenticated;

