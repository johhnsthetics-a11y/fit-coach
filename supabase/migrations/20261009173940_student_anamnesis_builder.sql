begin;

alter table public.nutrition_questionnaires
  add column if not exists questionnaire_type text not null default 'nutrition';

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'nutrition_questionnaires_type_check'
      and conrelid = 'public.nutrition_questionnaires'::regclass
  ) then
    alter table public.nutrition_questionnaires
      add constraint nutrition_questionnaires_type_check
      check (questionnaire_type in ('nutrition', 'anamnesis'));
  end if;
end;
$$;

alter table public.nutrition_questionnaire_assignments
  add column if not exists scheduled_for timestamptz not null default now(),
  add column if not exists priority_required boolean not null default false;

create index if not exists nutrition_questionnaire_student_due_idx
  on public.nutrition_questionnaire_assignments(student_id, scheduled_for, sent_at desc);

create or replace function public.assign_student_anamnesis(
  selected_questionnaire_id text,
  selected_student_id uuid,
  scheduled_for_value timestamptz,
  priority_required_value boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_id uuid := (select auth.uid());
  v_model public.nutrition_questionnaires%rowtype;
  v_assignment public.nutrition_questionnaire_assignments%rowtype;
  v_scheduled_for timestamptz := coalesce(scheduled_for_value, now());
begin
  if v_coach_id is null then
    raise exception 'Sessao profissional obrigatoria.' using errcode = '42501';
  end if;

  select q.*
    into v_model
  from public.nutrition_questionnaires as q
  where q.id = trim(selected_questionnaire_id)
    and q.coach_id = v_coach_id
    and q.questionnaire_type = 'anamnesis';

  if v_model.id is null or not exists (
    select 1
    from public.students as students
    where students.id = selected_student_id
      and students.coach_id = v_coach_id
  ) then
    raise exception 'Aluno ou anamnese nao pertence ao profissional.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(selected_student_id::text || ':' || v_model.id, 0)
  );

  select assignments.*
    into v_assignment
  from public.nutrition_questionnaire_assignments as assignments
  where assignments.student_id = selected_student_id
    and assignments.questionnaire_id = v_model.id
    and assignments.status = 'Pendente'
  for update;

  if v_assignment.id is null then
    insert into public.nutrition_questionnaire_assignments (
      coach_id,
      student_id,
      questionnaire_id,
      question_snapshot,
      scheduled_for,
      priority_required
    ) values (
      v_coach_id,
      selected_student_id,
      v_model.id,
      to_jsonb(v_model),
      v_scheduled_for,
      coalesce(priority_required_value, false)
    )
    returning * into v_assignment;
  else
    update public.nutrition_questionnaire_assignments
    set question_snapshot = to_jsonb(v_model),
        scheduled_for = v_scheduled_for,
        priority_required = coalesce(priority_required_value, false),
        answers = '{}'::jsonb,
        sent_at = now(),
        updated_at = now()
    where id = v_assignment.id
    returning * into v_assignment;
  end if;

  return to_jsonb(v_assignment);
end;
$$;

create or replace function public.student_nutrition_questionnaires_unchecked(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_coach_id uuid;
begin
  select invites.student_id, invites.coach_id
    into v_student_id, v_coach_id
  from public.student_invites as invites
  join public.students as students
    on students.id = invites.student_id
   and students.coach_id = invites.coach_id
  where invites.code = trim(invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  if v_student_id is null then
    raise exception 'Convite invalido ou expirado.' using errcode = '42501';
  end if;

  return (
    select coalesce(
      jsonb_agg(to_jsonb(assignments) order by assignments.sent_at desc),
      '[]'::jsonb
    )
    from public.nutrition_questionnaire_assignments as assignments
    where assignments.student_id = v_student_id
      and assignments.coach_id = v_coach_id
      and (
        assignments.status = 'Respondido'
        or assignments.scheduled_for <= now()
      )
  );
end;
$$;

create or replace function public.submit_nutrition_questionnaire_unchecked(
  invite_code text,
  selected_assignment_id uuid,
  answers_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite_id uuid;
  v_student_id uuid;
  v_coach_id uuid;
  v_student_name text;
  v_assignment public.nutrition_questionnaire_assignments%rowtype;
  v_question jsonb;
  v_answer jsonb;
  v_value jsonb;
  v_options jsonb;
  v_selected jsonb;
  v_is_anamnesis boolean;
begin
  if jsonb_typeof(answers_value) is distinct from 'object'
     or pg_column_size(answers_value) > 200000 then
    raise exception 'Respostas invalidas.' using errcode = '22023';
  end if;

  select invites.id, invites.student_id, invites.coach_id, students.name
    into v_invite_id, v_student_id, v_coach_id, v_student_name
  from public.student_invites as invites
  join public.students as students
    on students.id = invites.student_id
   and students.coach_id = invites.coach_id
  where invites.code = trim(invite_code)
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  select assignments.*
    into v_assignment
  from public.nutrition_questionnaire_assignments as assignments
  where assignments.id = selected_assignment_id
    and assignments.student_id = v_student_id
    and assignments.coach_id = v_coach_id
    and (
      assignments.status = 'Respondido'
      or assignments.scheduled_for <= now()
    )
  for update;

  if v_assignment.id is null then
    raise exception 'Questionario nao pertence ao aluno ou ainda nao esta disponivel.' using errcode = '42501';
  end if;

  if v_assignment.status = 'Respondido' then
    return to_jsonb(v_assignment);
  end if;

  if jsonb_typeof(v_assignment.question_snapshot->'questions') is distinct from 'array' then
    raise exception 'Questionario invalido.' using errcode = '22023';
  end if;

  for v_question in
    select value
    from jsonb_array_elements(v_assignment.question_snapshot->'questions')
  loop
    v_answer := answers_value->(v_question->>'id');
    v_value := case
      when jsonb_typeof(v_answer) = 'object' then v_answer->'value'
      else v_answer
    end;

    if coalesce((v_question->>'required')::boolean, false) and (
      v_value is null
      or v_value = 'null'::jsonb
      or (jsonb_typeof(v_value) = 'string' and trim(v_value #>> '{}') = '')
      or (jsonb_typeof(v_value) = 'array' and jsonb_array_length(v_value) = 0)
    ) then
      raise exception 'Responda todas as perguntas obrigatorias.' using errcode = '22023';
    end if;

    v_options := coalesce(v_question->'options', '[]'::jsonb);
    if v_value is not null
       and v_value not in ('null'::jsonb, '""'::jsonb)
       and v_question->>'type' in ('single', 'multiple') then
      if (v_question->>'type' = 'multiple' and jsonb_typeof(v_value) <> 'array')
         or (v_question->>'type' = 'single' and jsonb_typeof(v_value) <> 'string') then
        raise exception 'Selecao invalida.' using errcode = '22023';
      end if;

      for v_selected in
        select value
        from jsonb_array_elements(
          case when jsonb_typeof(v_value) = 'array' then v_value else jsonb_build_array(v_value) end
        )
      loop
        if not v_options @> jsonb_build_array(v_selected) then
          raise exception 'Opcao nao pertence a pergunta.' using errcode = '22023';
        end if;
        if lower(trim(v_selected #>> '{}')) in ('outra', 'outro', 'outros')
           and coalesce(trim(v_answer->>'otherText'), '') = '' then
          raise exception 'Especifique a opcao Outra.' using errcode = '22023';
        end if;
      end loop;
    end if;
  end loop;

  update public.nutrition_questionnaire_assignments
  set answers = answers_value,
      status = 'Respondido',
      completed_at = now(),
      updated_at = now()
  where id = v_assignment.id
  returning * into v_assignment;

  v_is_anamnesis := coalesce(v_assignment.question_snapshot->>'questionnaire_type', 'nutrition') = 'anamnesis';

  if v_is_anamnesis then
    insert into public.student_anamneses as current_anamnesis (
      coach_id,
      student_id,
      invite_id,
      answers,
      source,
      authored_by,
      submitted_at,
      updated_at,
      student_update_requested_at
    ) values (
      v_coach_id,
      v_student_id,
      v_invite_id,
      answers_value,
      'student',
      null,
      now(),
      now(),
      null
    )
    on conflict (student_id) do update set
      coach_id = excluded.coach_id,
      invite_id = excluded.invite_id,
      answers = excluded.answers,
      source = excluded.source,
      authored_by = excluded.authored_by,
      submitted_at = excluded.submitted_at,
      updated_at = excluded.updated_at,
      student_update_requested_at = null;

    insert into public.notifications (user_id, title, body, read)
    values (
      v_coach_id,
      'Nova anamnese recebida',
      coalesce(v_student_name, 'O aluno') || ' concluiu a anamnese solicitada.',
      false
    );
  end if;

  return to_jsonb(v_assignment);
end;
$$;

revoke all on public.nutrition_questionnaires, public.nutrition_questionnaire_assignments from anon;
revoke all on public.nutrition_questionnaire_assignments from authenticated;
grant select on public.nutrition_questionnaire_assignments to authenticated;

revoke all on function public.assign_student_anamnesis(text, uuid, timestamptz, boolean) from public, anon;
grant execute on function public.assign_student_anamnesis(text, uuid, timestamptz, boolean) to authenticated;
revoke all on function public.student_nutrition_questionnaires_unchecked(text) from public, anon, authenticated;
revoke all on function public.submit_nutrition_questionnaire_unchecked(text, uuid, jsonb) from public, anon, authenticated;

commit;
