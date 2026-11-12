-- BUILD41 follow-up: team invitees use scoped collaboration grants without a separate subscription.
-- Team creation, invitations, patient selection, and delegation management remain entitlement-gated.
-- Invite acceptance still verifies authenticated e-mail and matching professional role.
-- Data reads/writes remain constrained by active team membership, patient delegation, and patient consent.

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
