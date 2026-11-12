begin;

create schema if not exists private;

alter table public.students
  add column if not exists auth_user_id uuid;

create table if not exists public.professional_teams (
  id uuid primary key default gen_random_uuid(),
  owner_professional_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_team_members (
  team_id uuid not null references public.professional_teams(id) on delete cascade,
  member_professional_id uuid not null references public.users(id) on delete cascade,
  professional_role text not null check (professional_role in ('trainer', 'nutritionist')),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  invited_by uuid not null references public.users(id),
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, member_professional_id)
);

create table if not exists public.professional_team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.professional_teams(id) on delete cascade,
  invited_by uuid not null references public.users(id) on delete cascade,
  invitee_email text not null,
  expected_role text not null check (expected_role in ('trainer', 'nutritionist')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references public.users(id) on delete set null,
  accepted_at timestamptz
);

create unique index if not exists professional_team_invites_pending_email_idx
  on public.professional_team_invites (team_id, lower(invitee_email))
  where status = 'pending';

create table if not exists public.professional_patient_delegations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.professional_teams(id) on delete cascade,
  owner_professional_id uuid not null references public.users(id) on delete cascade,
  member_professional_id uuid not null references public.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  area text not null check (area in ('nutrition', 'workout')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  consent_status text not null default 'pending' check (consent_status in ('pending', 'accepted', 'declined', 'revoked')),
  consent_version text not null default '2026-11-11-collaboration-v1',
  requested_by uuid not null references public.users(id),
  requested_at timestamptz not null default now(),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, member_professional_id, student_id, area)
);

create table if not exists public.professional_collaboration_audit (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.professional_teams(id) on delete set null,
  owner_professional_id uuid references public.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  member_professional_id uuid references public.users(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  delegation_id uuid references public.professional_patient_delegations(id) on delete set null,
  area text check (area is null or area in ('nutrition', 'workout')),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists professional_team_members_member_idx
  on public.professional_team_members (member_professional_id, status);
create index if not exists professional_team_invites_email_idx
  on public.professional_team_invites (lower(invitee_email), status, expires_at);
create index if not exists professional_patient_delegations_member_idx
  on public.professional_patient_delegations (member_professional_id, area, status, consent_status);
create index if not exists professional_patient_delegations_student_idx
  on public.professional_patient_delegations (student_id, area, status, consent_status);
create index if not exists professional_collaboration_audit_team_idx
  on public.professional_collaboration_audit (team_id, created_at desc);

create table if not exists public.professional_apple_subscription_entitlements (
  original_transaction_id text primary key check (original_transaction_id ~ '^[0-9]{1,32}$'),
  owner_professional_id uuid not null references public.users(id) on delete cascade,
  transaction_id text not null check (transaction_id ~ '^[0-9]{1,32}$'),
  product_id text not null check (product_id in (
    'br.com.coachfitpro.ios.profissional.mensal',
    'br.com.coachfitpro.ios.profissional.semestral',
    'br.com.coachfitpro.ios.profissional.anual'
  )),
  apple_environment text not null check (apple_environment in ('Production', 'Sandbox')),
  status_code smallint not null check (status_code between 1 and 5),
  expires_at timestamptz,
  grace_expires_at timestamptz,
  revoked_at timestamptz,
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professional_apple_subscription_entitlements_owner_idx
  on public.professional_apple_subscription_entitlements (owner_professional_id, status_code, last_verified_at desc);

alter table public.professional_apple_subscription_entitlements enable row level security;
revoke all on public.professional_apple_subscription_entitlements from public, anon, authenticated;
grant select, insert, update on public.professional_apple_subscription_entitlements to service_role;

create or replace function private.prevent_apple_entitlement_owner_reassignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.owner_professional_id is distinct from old.owner_professional_id then
    raise exception 'A transação Apple já está vinculada a outra conta profissional.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists professional_apple_entitlement_owner_guard on public.professional_apple_subscription_entitlements;
create trigger professional_apple_entitlement_owner_guard
before update on public.professional_apple_subscription_entitlements
for each row execute function private.prevent_apple_entitlement_owner_reassignment();

revoke all on function private.prevent_apple_entitlement_owner_reassignment() from public, anon, authenticated;

alter table public.professional_teams enable row level security;
alter table public.professional_team_members enable row level security;
alter table public.professional_team_invites enable row level security;
alter table public.professional_patient_delegations enable row level security;
alter table public.professional_collaboration_audit enable row level security;

revoke all on public.professional_teams from public, anon, authenticated;
revoke all on public.professional_team_members from public, anon, authenticated;
revoke all on public.professional_team_invites from public, anon, authenticated;
revoke all on public.professional_patient_delegations from public, anon, authenticated;
revoke all on public.professional_collaboration_audit from public, anon, authenticated;

alter table public.nutrition_plans
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists collaboration_delegation_id uuid references public.professional_patient_delegations(id) on delete set null;

alter table public.workouts
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists collaboration_delegation_id uuid references public.professional_patient_delegations(id) on delete set null;

update public.nutrition_plans set created_by = coach_id where created_by is null;
update public.nutrition_plans set updated_by = coach_id where updated_by is null;
update public.workouts set created_by = coach_id where created_by is null;
update public.workouts set updated_by = coach_id where updated_by is null;

create or replace function private.coachfit_professional_role(target_professional_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when lower(btrim(coalesce(users.role, ''))) in ('nutritionist', 'nutricionista')
      or lower(coalesce(users.role, '')) like '%nutri%'
      then 'nutritionist'
    when lower(btrim(coalesce(users.role, ''))) in ('trainer', 'coach', 'personal trainer', 'personal_trainer', 'treinador', 'coach principal')
      then 'trainer'
    else null
  end
  from public.users
  where users.id = target_professional_id;
$$;

create or replace function private.coachfit_active_collaboration(target_student_id uuid, target_area text)
returns table(owner_professional_id uuid, delegation_id uuid, team_id uuid)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select d.owner_professional_id, d.id, d.team_id
  from public.professional_patient_delegations as d
  join public.professional_teams as t
    on t.id = d.team_id
   and t.owner_professional_id = d.owner_professional_id
  join public.professional_team_members as m
    on m.team_id = d.team_id
   and m.member_professional_id = d.member_professional_id
   and m.status = 'active'
  join public.students as s
    on s.id = d.student_id
   and s.coach_id = d.owner_professional_id
  where d.student_id = target_student_id
    and d.area = target_area
    and d.member_professional_id = auth.uid()
    and d.status = 'active'
    and d.consent_status = 'accepted'
    and private.coachfit_professional_role(auth.uid()) = case target_area
      when 'nutrition' then 'nutritionist'
      when 'workout' then 'trainer'
      else null
    end
  order by d.accepted_at desc nulls last, d.created_at desc
  limit 1;
$$;

revoke all on function private.coachfit_professional_role(uuid) from public, anon, authenticated;
revoke all on function private.coachfit_active_collaboration(uuid, text) from public, anon, authenticated;

create or replace function private.coachfit_professional_access_active(target_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select target_professional_id is not null and exists (
    select 1
    from public.users as professional
    where professional.id = target_professional_id
      and private.coachfit_professional_role(professional.id) is not null
      and (
        exists (
          select 1
          from public.coach_subscriptions as subscription
          where subscription.coach_id = professional.id
            and lower(btrim(coalesce(subscription.status, ''))) in (
              'active', 'paid', 'em dia', 'em_dia', 'trialing', 'approved', 'aprovado',
              'authorized', 'autorizado', 'completed', 'complete', 'ativo'
            )
            and (subscription.current_period_ends_at is null or subscription.current_period_ends_at > now())
        )
        or exists (
          select 1
          from public.affiliate_professionals as affiliate
          where affiliate.active = true
            and lower(btrim(affiliate.email)) = lower(btrim(professional.email))
        )
        or exists (
          select 1
          from public.professional_apple_subscription_entitlements as apple
          where apple.owner_professional_id = professional.id
            and apple.status_code in (1, 4)
            and apple.revoked_at is null
            and apple.last_verified_at > now() - interval '1 minute'
            and (
              (apple.status_code = 1 and apple.expires_at > now())
              or (apple.status_code = 4 and apple.grace_expires_at > now())
            )
        )
      )
  );
$$;

create or replace function private.coachfit_require_professional_access()
returns void
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.coachfit_professional_access_active(auth.uid()) then
    raise exception 'A assinatura profissional não está ativa ou ainda não foi validada pelo servidor.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.coachfit_professional_access_active(uuid) from public, anon, authenticated;
revoke all on function private.coachfit_require_professional_access() from public, anon, authenticated;

create or replace function public.create_professional_team(team_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  saved public.professional_teams%rowtype;
begin
  actor_role := private.coachfit_professional_role(actor_id);
  if actor_id is null or actor_role is null then
    raise exception 'Conta profissional não identificada.' using errcode = '42501';
  end if;
  perform private.coachfit_require_professional_access();
  if char_length(btrim(coalesce(team_name, ''))) not between 2 and 80 then
    raise exception 'Informe um nome de equipe entre 2 e 80 caracteres.' using errcode = '22023';
  end if;

  insert into public.professional_teams (owner_professional_id, name)
  values (actor_id, btrim(team_name))
  returning * into saved;

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, action, details)
  values (saved.id, actor_id, actor_id, 'team_created', jsonb_build_object('name', saved.name));

  return jsonb_build_object('id', saved.id, 'name', saved.name, 'ownerProfessionalId', actor_id, 'isOwner', true);
end;
$$;

create or replace function public.create_professional_team_invite(
  selected_team_id uuid,
  invitee_email text,
  expected_professional_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  team_row public.professional_teams%rowtype;
  invitee public.users%rowtype;
  saved public.professional_team_invites%rowtype;
  normalized_email text := lower(btrim(coalesce(invitee_email, '')));
  normalized_role text := lower(btrim(coalesce(expected_professional_role, '')));
begin
  if actor_id is null then raise exception 'Sessão profissional não identificada.' using errcode = '42501'; end if;
  perform private.coachfit_require_professional_access();
  select * into team_row from public.professional_teams where id = selected_team_id and owner_professional_id = actor_id;
  if not found then raise exception 'Somente o responsável pode convidar membros para esta equipe.' using errcode = '42501'; end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  if normalized_role not in ('trainer', 'nutritionist') then
    raise exception 'O papel do profissional convidado é inválido.' using errcode = '22023';
  end if;
  if normalized_email = lower((select email from public.users where id = actor_id)) then
    raise exception 'Você não pode convidar sua própria conta para a equipe.' using errcode = '22023';
  end if;

  select * into invitee from public.users where lower(email) = normalized_email limit 1;
  if invitee.id is not null then
    if private.coachfit_professional_role(invitee.id) is distinct from normalized_role then
      raise exception 'O e-mail informado não corresponde a uma conta profissional do papel selecionado.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.professional_team_members m
      where m.team_id = selected_team_id and m.member_professional_id = invitee.id and m.status = 'active'
    ) then
      raise exception 'Este profissional já participa desta equipe.' using errcode = '23505';
    end if;
  end if;

  update public.professional_team_invites as existing_invite
  set status = 'cancelled'
  where existing_invite.team_id = selected_team_id
    and lower(existing_invite.invitee_email) = normalized_email
    and existing_invite.status = 'pending';

  insert into public.professional_team_invites (team_id, invited_by, invitee_email, expected_role, status, expires_at)
  values (selected_team_id, actor_id, normalized_email, normalized_role, 'pending', now() + interval '14 days')
  returning * into saved;

  if invitee.id is not null and to_regclass('public.notifications') is not null then
    insert into public.notifications (user_id, title, body)
    values (invitee.id, 'Convite para uma equipe profissional', 'Você recebeu um convite para participar de uma equipe no Coach Fit Pro. Abra Equipe para revisar e aceitar ou recusar.');
  end if;

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, action, details)
  values (selected_team_id, actor_id, actor_id, invitee.id, 'member_invited', jsonb_build_object('email', normalized_email, 'expectedRole', normalized_role, 'inviteId', saved.id));

  return jsonb_build_object('id', saved.id, 'teamId', saved.team_id, 'inviteeEmail', saved.invitee_email, 'expectedRole', saved.expected_role, 'status', saved.status, 'expiresAt', saved.expires_at);
end;
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
  perform private.coachfit_require_professional_access();
  select lower(email) into actor_email from public.users where id = actor_id;

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
                'role', i.expected_role,
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
        'inviteeEmail', i.invitee_email,
        'expectedRole', i.expected_role,
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
  perform private.coachfit_require_professional_access();
  select lower(email) into actor_email from public.users where id = actor_id;
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

  insert into public.professional_team_members (team_id, member_professional_id, professional_role, status, invited_by, accepted_at, updated_at)
  values (invite_row.team_id, actor_id, actor_role, 'active', invite_row.invited_by, now(), now())
  on conflict (team_id, member_professional_id) do update
    set professional_role = excluded.professional_role, status = 'active', invited_by = excluded.invited_by,
        accepted_at = now(), updated_at = now();

  update public.professional_team_invites
  set status = 'accepted', accepted_by = actor_id, accepted_at = now()
  where id = selected_invite_id;

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, action, details)
  values (invite_row.team_id, team_row.owner_professional_id, actor_id, actor_id, 'member_accepted_invite', jsonb_build_object('inviteId', selected_invite_id));

  return jsonb_build_object('teamId', invite_row.team_id, 'status', 'active');
end;
$$;

create or replace function public.decline_professional_team_invite(selected_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  invite_row public.professional_team_invites%rowtype;
begin
  if actor_id is null then raise exception 'Sessão profissional não identificada.' using errcode = '42501'; end if;
  select lower(email) into actor_email from public.users where id = actor_id;
  update public.professional_team_invites
  set status = 'declined'
  where id = selected_invite_id
    and status = 'pending'
    and expires_at > now()
    and lower(invitee_email) = actor_email
    and expected_role = private.coachfit_professional_role(actor_id)
  returning * into invite_row;
  if not found then raise exception 'Convite não encontrado ou destinado a outra conta.' using errcode = '42501'; end if;
  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, action, details)
  select invite_row.team_id, t.owner_professional_id, actor_id, actor_id, 'member_declined_invite', jsonb_build_object('inviteId', selected_invite_id)
  from public.professional_teams t where t.id = invite_row.team_id;
  return true;
end;
$$;

create or replace function public.cancel_professional_team_invite(selected_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  invite_row public.professional_team_invites%rowtype;
begin
  update public.professional_team_invites i
  set status = 'cancelled'
  from public.professional_teams t
  where i.id = selected_invite_id and i.team_id = t.id and t.owner_professional_id = actor_id and i.status = 'pending'
  returning i.* into invite_row;
  if not found then raise exception 'Convite pendente não encontrado para esta equipe.' using errcode = '42501'; end if;
  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, action, details)
  values (invite_row.team_id, actor_id, actor_id, 'invite_cancelled', jsonb_build_object('inviteId', selected_invite_id));
  return true;
end;
$$;

create or replace function public.remove_professional_team_member(selected_team_id uuid, selected_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  team_row public.professional_teams%rowtype;
begin
  select * into team_row from public.professional_teams where id = selected_team_id and owner_professional_id = actor_id;
  if not found then raise exception 'Somente o responsável pode remover membros desta equipe.' using errcode = '42501'; end if;
  if selected_member_id = actor_id then raise exception 'O responsável não pode remover a própria conta como membro.' using errcode = '22023'; end if;
  update public.professional_team_members
  set status = 'removed', updated_at = now()
  where team_id = selected_team_id and member_professional_id = selected_member_id and status = 'active';
  if not found then raise exception 'Membro ativo não encontrado nesta equipe.' using errcode = '42501'; end if;
  update public.professional_patient_delegations
  set status = 'revoked', consent_status = 'revoked', revoked_at = now(), updated_at = now()
  where team_id = selected_team_id and member_professional_id = selected_member_id and status = 'active';
  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, action)
  values (selected_team_id, actor_id, actor_id, selected_member_id, 'member_removed');
  return true;
end;
$$;

create or replace function public.leave_professional_team(selected_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  team_row public.professional_teams%rowtype;
begin
  select * into team_row from public.professional_teams where id = selected_team_id;
  if not found or team_row.owner_professional_id = actor_id then
    raise exception 'O responsável não pode sair da própria equipe por este fluxo.' using errcode = '42501';
  end if;
  update public.professional_team_members
  set status = 'left', updated_at = now()
  where team_id = selected_team_id and member_professional_id = actor_id and status = 'active';
  if not found then raise exception 'Você não participa ativamente desta equipe.' using errcode = '42501'; end if;
  update public.professional_patient_delegations
  set status = 'revoked', consent_status = 'revoked', revoked_at = now(), updated_at = now()
  where team_id = selected_team_id and member_professional_id = actor_id and status = 'active';
  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, action)
  values (selected_team_id, team_row.owner_professional_id, actor_id, actor_id, 'member_left_team');
  return true;
end;
$$;

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
    select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'goal', s.goal) order by s.name)
    from public.students s where s.coach_id = actor_id
  ), '[]'::jsonb);
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
      consent_version, requested_by, requested_at, accepted_by, accepted_at, revoked_at, updated_at
    ) values (
      selected_team_id, actor_id, selected_member_id, current_student_id, selected_area, 'active', 'pending',
      '2026-11-11-collaboration-v1', actor_id, now(), null, null, null, now()
    )
    on conflict (team_id, member_professional_id, student_id, area) do update
      set status = 'active',
          consent_status = case
            when professional_patient_delegations.status = 'active'
              and professional_patient_delegations.consent_status = 'accepted'
              then 'accepted'
            else 'pending'
          end,
          requested_by = actor_id,
          requested_at = case
            when professional_patient_delegations.status = 'active'
              and professional_patient_delegations.consent_status = 'accepted'
              then professional_patient_delegations.requested_at
            else now()
          end,
          accepted_by = case
            when professional_patient_delegations.status = 'active'
              and professional_patient_delegations.consent_status = 'accepted'
              then professional_patient_delegations.accepted_by
            else null
          end,
          accepted_at = case
            when professional_patient_delegations.status = 'active'
              and professional_patient_delegations.consent_status = 'accepted'
              then professional_patient_delegations.accepted_at
            else null
          end,
          revoked_at = null,
          updated_at = now()
    returning * into saved;

    if previous_status is distinct from 'active' or previous_consent_status is distinct from 'accepted' then
      insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, student_id, delegation_id, area, action)
      values (selected_team_id, actor_id, actor_id, selected_member_id, current_student_id, saved.id, selected_area, 'patient_consent_requested');
    end if;
  end loop;

  return public.get_professional_team_workspace();
end;
$$;

create or replace function public.revoke_professional_patient_delegation(selected_delegation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  saved public.professional_patient_delegations%rowtype;
begin
  update public.professional_patient_delegations d
  set status = 'revoked', consent_status = 'revoked', revoked_at = now(), updated_at = now()
  from public.professional_teams t
  where d.id = selected_delegation_id and d.team_id = t.id
    and t.owner_professional_id = actor_id and d.status = 'active'
  returning d.* into saved;
  if not found then raise exception 'Liberação ativa não encontrada para esta equipe.' using errcode = '42501'; end if;
  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, student_id, delegation_id, area, action)
  values (saved.team_id, actor_id, actor_id, saved.member_professional_id, saved.student_id, saved.id, saved.area, 'patient_delegation_revoked_by_owner');
  return true;
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
      'consentVersion', d.consent_version
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
  normalized_decision text := lower(btrim(coalesce(decision, '')));
  consent_status_value text;
begin
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

create or replace function public.get_student_professional_collaborators(invite_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  active_invite public.student_invites%rowtype;
begin
  select * into active_invite from public.student_invites
  where code = btrim(coalesce(invite_code, '')) and status = 'active'
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;
  if not found then raise exception 'Convite do aluno inválido ou expirado.' using errcode = '42501'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'delegationId', d.id,
      'area', d.area,
      'professionalId', u.id,
      'professionalName', coalesce(u.name, 'Profissional'),
      'professionalRole', m.professional_role,
      'teamName', t.name
    ) order by d.area, u.name)
    from public.professional_patient_delegations d
    join public.professional_teams t on t.id = d.team_id and t.owner_professional_id = d.owner_professional_id
    join public.professional_team_members m on m.team_id = d.team_id and m.member_professional_id = d.member_professional_id and m.status = 'active'
    join public.users u on u.id = d.member_professional_id
    join public.students s on s.id = d.student_id and s.coach_id = active_invite.coach_id
    where d.student_id = active_invite.student_id and d.owner_professional_id = active_invite.coach_id
      and d.status = 'active' and d.consent_status = 'accepted'
      and private.coachfit_professional_role(d.member_professional_id) = case d.area when 'nutrition' then 'nutritionist' when 'workout' then 'trainer' else null end
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_professional_delegated_workspace(selected_area text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  actor_is_owner boolean := false;
begin
  actor_role := private.coachfit_professional_role(actor_id);
  if actor_id is null or selected_area not in ('nutrition', 'workout') then
    raise exception 'Área colaborativa inválida.' using errcode = '42501';
  end if;
  perform private.coachfit_require_professional_access();

  select exists (
    select 1
    from public.professional_patient_delegations d
    join public.professional_teams t on t.id = d.team_id and t.owner_professional_id = d.owner_professional_id
    join public.professional_team_members m on m.team_id = d.team_id and m.member_professional_id = d.member_professional_id and m.status = 'active'
    where d.owner_professional_id = actor_id and d.area = selected_area
      and d.status = 'active' and d.consent_status = 'accepted'
  ) into actor_is_owner;

  if (selected_area = 'nutrition' and actor_role is distinct from 'nutritionist' and not actor_is_owner)
     or (selected_area = 'workout' and actor_role is distinct from 'trainer' and not actor_is_owner) then
    raise exception 'A área solicitada não corresponde ao papel desta conta.' using errcode = '42501';
  end if;

  if selected_area = 'nutrition' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'delegationId', d.id,
        'ownerProfessionalId', d.owner_professional_id,
        'ownerName', owner_user.name,
        'student', jsonb_build_object('id', s.id, 'name', s.name, 'goal', s.goal, 'phase', s.phase, 'weight', s.weight, 'bodyFat', s.body_fat, 'calories', s.calories, 'protein', s.protein),
        'nutritionPlans', coalesce((
          select jsonb_agg(to_jsonb(np) || jsonb_build_object('nutrition_meals', coalesce((
            select jsonb_agg(to_jsonb(nm) order by nm.order_index) from public.nutrition_meals nm where nm.nutrition_plan_id = np.id
          ), '[]'::jsonb)) order by np.created_at desc)
          from public.nutrition_plans np where np.student_id = s.id and np.coach_id = d.owner_professional_id
        ), '[]'::jsonb)
      ) order by s.name)
      from public.professional_patient_delegations d
      join public.professional_teams t on t.id = d.team_id and t.owner_professional_id = d.owner_professional_id
      join public.professional_team_members m on m.team_id = d.team_id and m.member_professional_id = d.member_professional_id and m.status = 'active'
      join public.students s on s.id = d.student_id and s.coach_id = d.owner_professional_id
      join public.users owner_user on owner_user.id = d.owner_professional_id
      where d.area = 'nutrition' and d.status = 'active' and d.consent_status = 'accepted'
        and (d.member_professional_id = actor_id or d.owner_professional_id = actor_id)
        and (d.member_professional_id <> actor_id or private.coachfit_professional_role(actor_id) = 'nutritionist')
    ), '[]'::jsonb);
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'delegationId', d.id,
      'ownerProfessionalId', d.owner_professional_id,
      'ownerName', owner_user.name,
      'student', jsonb_build_object('id', s.id, 'name', s.name, 'goal', s.goal, 'phase', s.phase),
      'workouts', coalesce((
        select jsonb_agg(to_jsonb(w) || jsonb_build_object('workout_exercises', coalesce((
          select jsonb_agg(to_jsonb(we) order by we.order_index) from public.workout_exercises we where we.workout_id = w.id
        ), '[]'::jsonb)) order by w.created_at desc)
        from public.workouts w where w.student_id = s.id and w.coach_id = d.owner_professional_id
      ), '[]'::jsonb),
      'workoutLogs', coalesce((
        select jsonb_agg(to_jsonb(wl) order by wl.completed_at desc)
        from public.workout_logs wl where wl.student_id = s.id and wl.coach_id = d.owner_professional_id
      ), '[]'::jsonb)
    ) order by s.name)
    from public.professional_patient_delegations d
    join public.professional_teams t on t.id = d.team_id and t.owner_professional_id = d.owner_professional_id
    join public.professional_team_members m on m.team_id = d.team_id and m.member_professional_id = d.member_professional_id and m.status = 'active'
    join public.students s on s.id = d.student_id and s.coach_id = d.owner_professional_id
    join public.users owner_user on owner_user.id = d.owner_professional_id
    where d.area = 'workout' and d.status = 'active' and d.consent_status = 'accepted'
      and (d.member_professional_id = actor_id or d.owner_professional_id = actor_id)
      and (d.member_professional_id <> actor_id or private.coachfit_professional_role(actor_id) = 'trainer')
  ), '[]'::jsonb);
end;
$$;

create or replace function public.save_collaborative_nutrition_plan(plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  student_id_value uuid := nullif(plan->>'student_id', '')::uuid;
  plan_id_value uuid := nullif(plan->>'id', '')::uuid;
  owner_id uuid;
  delegation_value uuid;
  saved_plan public.nutrition_plans%rowtype;
  saved_meal public.nutrition_meals%rowtype;
  meal jsonb;
  saved_meals jsonb := '[]'::jsonb;
  position_index integer := 0;
  meal_id_value uuid;
  meal_updated boolean;
begin
  if actor_id is null or private.coachfit_professional_role(actor_id) <> 'nutritionist' then
    raise exception 'Somente uma conta de nutricionista pode salvar dietas colaborativas.' using errcode = '42501';
  end if;
  perform private.coachfit_require_professional_access();
  select active.owner_professional_id, active.delegation_id into owner_id, delegation_value
  from private.coachfit_active_collaboration(student_id_value, 'nutrition') as active;
  if owner_id is null then raise exception 'Este paciente não está liberado para este nutricionista ou o consentimento foi revogado.' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(plan->'meals', '[]'::jsonb)) <> 'array' then raise exception 'Refeições inválidas.' using errcode = '22023'; end if;

  if plan_id_value is not null then
    update public.nutrition_plans
       set title = coalesce(nullif(plan->>'title', ''), title),
           calories = coalesce(plan->>'calories', calories),
           protein = coalesce(plan->>'protein', protein),
           notes = coalesce(plan->>'notes', notes),
           active = true,
           updated_by = actor_id,
           collaboration_delegation_id = delegation_value
     where id = plan_id_value and coach_id = owner_id and student_id = student_id_value
     returning * into saved_plan;
    if not found then raise exception 'Dieta não encontrada para este paciente responsável.' using errcode = '42501'; end if;
  else
    insert into public.nutrition_plans (coach_id, student_id, title, calories, protein, notes, active, created_by, updated_by, collaboration_delegation_id)
    values (owner_id, student_id_value, coalesce(nullif(plan->>'title', ''), 'Plano alimentar'), coalesce(plan->>'calories', ''), coalesce(plan->>'protein', ''), coalesce(plan->>'notes', ''), true, actor_id, actor_id, delegation_value)
    returning * into saved_plan;
  end if;

  for meal in select value from jsonb_array_elements(coalesce(plan->'meals', '[]'::jsonb)) loop
    meal_id_value := case
      when coalesce(meal->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (meal->>'id')::uuid
      else null
    end;
    meal_updated := false;
    if meal_id_value is not null then
      update public.nutrition_meals
         set name = coalesce(meal->>'name', ''),
             foods = coalesce(meal->>'foods', ''),
             macros = coalesce(meal->>'macros', ''),
             time_label = coalesce(meal->>'time', ''),
             order_index = coalesce(nullif(meal->>'order_index', '')::integer, position_index)
       where id = meal_id_value and nutrition_plan_id = saved_plan.id
       returning * into saved_meal;
      meal_updated := found;
    end if;
    if not meal_updated then
      insert into public.nutrition_meals (nutrition_plan_id, name, foods, macros, time_label, order_index)
      values (saved_plan.id, coalesce(meal->>'name', ''), coalesce(meal->>'foods', ''), coalesce(meal->>'macros', ''), coalesce(meal->>'time', ''), coalesce(nullif(meal->>'order_index', '')::integer, position_index))
      returning * into saved_meal;
    end if;
    saved_meals := saved_meals || jsonb_build_array(to_jsonb(saved_meal));
    position_index := position_index + 1;
  end loop;

  if plan_id_value is not null then
    delete from public.nutrition_meals existing
    where existing.nutrition_plan_id = saved_plan.id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(plan->'meals', '[]'::jsonb)) as submitted(meal)
        where case
          when coalesce(submitted.meal->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (submitted.meal->>'id')::uuid
          else null
        end = existing.id
      );
  end if;

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, student_id, delegation_id, area, action, details)
  select delegation.team_id, owner_id, actor_id, actor_id, student_id_value, delegation_value, 'nutrition', 'nutrition_plan_saved', jsonb_build_object('planId', saved_plan.id)
  from public.professional_patient_delegations delegation where delegation.id = delegation_value;

  return to_jsonb(saved_plan) || jsonb_build_object('nutrition_meals', saved_meals);
end;
$$;

create or replace function public.save_collaborative_workout(workout_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  student_id_value uuid;
  workout_id_value uuid;
  owner_id uuid;
  delegation_value uuid;
  request_id_value text := nullif(workout_payload->>'request_id', '');
  publication_status_value text := lower(coalesce(nullif(workout_payload->>'publication_status', ''), 'published'));
  is_published boolean;
  publish_marker text;
  exercises jsonb := coalesce(workout_payload->'exercises', '[]'::jsonb);
  saved_row public.workouts%rowtype;
  result jsonb;
begin
  if actor_id is null or private.coachfit_professional_role(actor_id) <> 'trainer' then
    raise exception 'Somente uma conta de treinador pode salvar treinos colaborativos.' using errcode = '42501';
  end if;
  perform private.coachfit_require_professional_access();
  begin student_id_value := nullif(workout_payload->>'student_id', '')::uuid;
  exception when invalid_text_representation then raise exception 'Paciente inválido.' using errcode = '22023'; end;
  select active.owner_professional_id, active.delegation_id into owner_id, delegation_value
  from private.coachfit_active_collaboration(student_id_value, 'workout') as active;
  if owner_id is null then raise exception 'Este paciente não está liberado para este treinador ou o consentimento foi revogado.' using errcode = '42501'; end if;
  if publication_status_value not in ('draft', 'published') then raise exception 'Estado de publicação inválido.' using errcode = '22023'; end if;
  if jsonb_typeof(exercises) <> 'array' then raise exception 'A lista de exercícios precisa ser um array.' using errcode = '22023'; end if;
  if request_id_value is not null and request_id_value !~ '^[A-Za-z0-9_-]{12,120}$' then raise exception 'Identificador de publicação inválido.' using errcode = '22023'; end if;
  is_published := publication_status_value = 'published';
  begin workout_id_value := nullif(workout_payload->>'id', '')::uuid;
  exception when invalid_text_representation then workout_id_value := null; end;

  if workout_id_value is null and request_id_value is not null then
    perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || request_id_value, 0));
    publish_marker := '[coachfitpro-publish:' || request_id_value || ']';
    select w.id into workout_id_value from public.workouts w
    where w.coach_id = owner_id and w.student_id = student_id_value and position(publish_marker in coalesce(w.notes, '')) > 0
    order by w.created_at desc limit 1;
  end if;

  if workout_id_value is not null then
    update public.workouts
       set student_id = student_id_value,
           title = coalesce(nullif(workout_payload->>'title', ''), 'Treino'),
           focus = nullif(workout_payload->>'focus', ''),
           notes = nullif(concat_ws(E'\n', nullif(workout_payload->>'notes', ''), case when request_id_value is not null then '[coachfitpro-publish:' || request_id_value || ']' end), ''),
           active = is_published,
           publication_status = publication_status_value,
           updated_by = actor_id,
           collaboration_delegation_id = delegation_value
     where id = workout_id_value and coach_id = owner_id and student_id = student_id_value
     returning * into saved_row;
    if not found then raise exception 'Treino não encontrado para este paciente responsável.' using errcode = '42501'; end if;
  else
    insert into public.workouts (coach_id, student_id, title, focus, notes, active, publication_status, created_by, updated_by, collaboration_delegation_id)
    values (owner_id, student_id_value, coalesce(nullif(workout_payload->>'title', ''), 'Treino'), nullif(workout_payload->>'focus', ''),
      nullif(concat_ws(E'\n', nullif(workout_payload->>'notes', ''), case when request_id_value is not null then '[coachfitpro-publish:' || request_id_value || ']' end), ''),
      is_published, publication_status_value, actor_id, actor_id, delegation_value)
    returning * into saved_row;
    workout_id_value := saved_row.id;
  end if;

  delete from public.workout_exercises where workout_id = workout_id_value;
  insert into public.workout_exercises (workout_id, name, sets, reps, load, rest, muscle_group, equipment, instructions, video_url, image_url, external_id, order_index)
  select parsed.workout_id, parsed.name, parsed.sets, parsed.reps, parsed.load, parsed.rest, parsed.muscle_group, parsed.equipment,
         parsed.instructions, parsed.video_url, parsed.image_url, parsed.external_id, parsed.order_index
  from jsonb_array_elements(exercises) with ordinality as item(exercise, position)
  cross join lateral jsonb_populate_record(null::public.workout_exercises,
    item.exercise || jsonb_build_object('workout_id', workout_id_value, 'name', coalesce(nullif(item.exercise->>'name', ''), 'Exercício'), 'order_index', (item.position - 1)::integer)
  ) as parsed;

  select to_jsonb(w) || jsonb_build_object('workout_exercises', coalesce((
    select jsonb_agg(to_jsonb(we) order by we.order_index) from public.workout_exercises we where we.workout_id = w.id
  ), '[]'::jsonb)) into result from public.workouts w where w.id = workout_id_value and w.coach_id = owner_id;

  insert into public.professional_collaboration_audit (team_id, owner_professional_id, actor_user_id, member_professional_id, student_id, delegation_id, area, action, details)
  select delegation.team_id, owner_id, actor_id, actor_id, student_id_value, delegation_value, 'workout', 'workout_saved', jsonb_build_object('workoutId', workout_id_value, 'publicationStatus', publication_status_value)
  from public.professional_patient_delegations delegation where delegation.id = delegation_value;

  return result;
end;
$$;

revoke all on function public.create_professional_team(text) from public, anon;
revoke all on function public.create_professional_team_invite(uuid, text, text) from public, anon;
revoke all on function public.get_professional_team_workspace() from public, anon;
revoke all on function public.accept_professional_team_invite(uuid) from public, anon;
revoke all on function public.decline_professional_team_invite(uuid) from public, anon;
revoke all on function public.cancel_professional_team_invite(uuid) from public, anon;
revoke all on function public.remove_professional_team_member(uuid, uuid) from public, anon;
revoke all on function public.leave_professional_team(uuid) from public, anon;
revoke all on function public.list_professional_team_candidates() from public, anon;
revoke all on function public.replace_professional_patient_delegations(uuid, uuid, text, uuid[]) from public, anon;
revoke all on function public.revoke_professional_patient_delegation(uuid) from public, anon;
revoke all on function public.get_current_student_collaboration_requests() from public, anon;
revoke all on function public.respond_to_professional_collaboration(uuid, text) from public, anon;
revoke all on function public.get_student_professional_collaborators(text) from public;
revoke all on function public.get_professional_delegated_workspace(text) from public, anon;
revoke all on function public.save_collaborative_nutrition_plan(jsonb) from public, anon;
revoke all on function public.save_collaborative_workout(jsonb) from public, anon;

grant execute on function public.create_professional_team(text) to authenticated;
grant execute on function public.create_professional_team_invite(uuid, text, text) to authenticated;
grant execute on function public.get_professional_team_workspace() to authenticated;
grant execute on function public.accept_professional_team_invite(uuid) to authenticated;
grant execute on function public.decline_professional_team_invite(uuid) to authenticated;
grant execute on function public.cancel_professional_team_invite(uuid) to authenticated;
grant execute on function public.remove_professional_team_member(uuid, uuid) to authenticated;
grant execute on function public.leave_professional_team(uuid) to authenticated;
grant execute on function public.list_professional_team_candidates() to authenticated;
grant execute on function public.replace_professional_patient_delegations(uuid, uuid, text, uuid[]) to authenticated;
grant execute on function public.revoke_professional_patient_delegation(uuid) to authenticated;
grant execute on function public.get_current_student_collaboration_requests() to authenticated;
grant execute on function public.respond_to_professional_collaboration(uuid, text) to authenticated;
grant execute on function public.get_student_professional_collaborators(text) to anon, authenticated;
grant execute on function public.get_professional_delegated_workspace(text) to authenticated;
grant execute on function public.save_collaborative_nutrition_plan(jsonb) to authenticated;
grant execute on function public.save_collaborative_workout(jsonb) to authenticated;

commit;
