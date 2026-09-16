begin;

create table if not exists public.nutrition_questionnaires (
  id text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 100),
  status text not null default 'Rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_questionnaire_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  questionnaire_id text not null references public.nutrition_questionnaires(id),
  question_snapshot jsonb not null,
  answers jsonb not null default '{}',
  status text not null default 'Pendente' check (status in ('Pendente', 'Respondido')),
  sent_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists nutrition_questionnaire_pending_unique
  on public.nutrition_questionnaire_assignments(student_id, questionnaire_id) where status = 'Pendente';
create index if not exists nutrition_questionnaire_coach_idx
  on public.nutrition_questionnaire_assignments(coach_id, sent_at desc);

alter table public.nutrition_questionnaires enable row level security;
alter table public.nutrition_questionnaire_assignments enable row level security;
drop policy if exists questionnaire_owner on public.nutrition_questionnaires;
create policy questionnaire_owner on public.nutrition_questionnaires to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists questionnaire_owner_guard on public.nutrition_questionnaires;
create policy questionnaire_owner_guard on public.nutrition_questionnaires as restrictive to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists questionnaire_assignment_owner on public.nutrition_questionnaire_assignments;
create policy questionnaire_assignment_owner on public.nutrition_questionnaire_assignments for select to authenticated
  using (coach_id = auth.uid());
drop policy if exists questionnaire_assignment_guard on public.nutrition_questionnaire_assignments;
create policy questionnaire_assignment_guard on public.nutrition_questionnaire_assignments as restrictive for select to authenticated
  using (coach_id = auth.uid());
revoke all on public.nutrition_questionnaires, public.nutrition_questionnaire_assignments from anon;
grant select, insert, update, delete on public.nutrition_questionnaires to authenticated;
revoke all on public.nutrition_questionnaire_assignments from authenticated;
grant select on public.nutrition_questionnaire_assignments to authenticated;

create or replace function public.assign_nutrition_questionnaire(selected_questionnaire_id text, selected_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_model public.nutrition_questionnaires%rowtype;
  v_assignment public.nutrition_questionnaire_assignments%rowtype;
begin
  select * into v_model from public.nutrition_questionnaires q
  where q.id = selected_questionnaire_id and q.coach_id = auth.uid();
  if v_model.id is null or not exists (
    select 1 from public.students s where s.id = selected_student_id and s.coach_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Aluno ou questionario nao pertence ao profissional.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(selected_student_id::text || ':' || selected_questionnaire_id, 0));
  select * into v_assignment from public.nutrition_questionnaire_assignments a
  where a.student_id = selected_student_id and a.questionnaire_id = selected_questionnaire_id and a.status = 'Pendente';
  if v_assignment.id is null then
    insert into public.nutrition_questionnaire_assignments(coach_id, student_id, questionnaire_id, question_snapshot)
    values (auth.uid(), selected_student_id, selected_questionnaire_id, to_jsonb(v_model)) returning * into v_assignment;
  end if;
  return to_jsonb(v_assignment);
end;
$$;

create or replace function public.student_nutrition_questionnaires(invite_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_student uuid; v_coach uuid;
begin
  select i.student_id, i.coach_id into v_student, v_coach from public.student_invites i
  join public.students s on s.id = i.student_id and s.coach_id = i.coach_id
  where i.code = trim(invite_code) and i.status = 'active' and (i.expires_at is null or i.expires_at > now())
  order by i.created_at desc limit 1;
  if v_student is null then
    raise exception using errcode = '42501', message = 'Convite invalido ou expirado.';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(a) order by a.sent_at desc), '[]'::jsonb)
    from public.nutrition_questionnaire_assignments a where a.student_id = v_student and a.coach_id = v_coach);
end;
$$;

create or replace function public.submit_nutrition_questionnaire(invite_code text, selected_assignment_id uuid, answers_value jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_student uuid; v_coach uuid;
  v_assignment public.nutrition_questionnaire_assignments%rowtype;
  v_question jsonb; v_answer jsonb; v_value jsonb; v_options jsonb; v_selected jsonb;
begin
  if jsonb_typeof(answers_value) is distinct from 'object' or pg_column_size(answers_value) > 200000 then
    raise exception using errcode = '22023', message = 'Respostas invalidas.';
  end if;
  select i.student_id, i.coach_id into v_student, v_coach from public.student_invites i
  join public.students s on s.id = i.student_id and s.coach_id = i.coach_id
  where i.code = trim(invite_code) and i.status = 'active' and (i.expires_at is null or i.expires_at > now())
  order by i.created_at desc limit 1;
  select * into v_assignment from public.nutrition_questionnaire_assignments a
  where a.id = selected_assignment_id and a.student_id = v_student and a.coach_id = v_coach for update;
  if v_assignment.id is null then
    raise exception using errcode = '42501', message = 'Questionario nao pertence ao aluno.';
  end if;
  if v_assignment.status = 'Respondido' then return to_jsonb(v_assignment); end if;
  for v_question in select value from jsonb_array_elements(v_assignment.question_snapshot->'questions') loop
    v_answer := answers_value->(v_question->>'id');
    v_value := case when jsonb_typeof(v_answer) = 'object' then v_answer->'value' else v_answer end;
    if coalesce((v_question->>'required')::boolean, false) and (
      v_value is null or v_value = 'null'::jsonb or v_value = '[]'::jsonb or trim(v_value #>> '{}') = ''
    ) then raise exception using errcode = '22023', message = 'Responda todas as perguntas obrigatorias.'; end if;
    v_options := coalesce(v_question->'options', '[]'::jsonb);
    if v_value is not null and v_value not in ('null'::jsonb, '""'::jsonb) and v_question->>'type' in ('single', 'multiple') then
      if (v_question->>'type' = 'multiple' and jsonb_typeof(v_value) <> 'array') or
         (v_question->>'type' = 'single' and jsonb_typeof(v_value) <> 'string') then
        raise exception using errcode = '22023', message = 'Selecao invalida.';
      end if;
      for v_selected in select value from jsonb_array_elements(case when jsonb_typeof(v_value) = 'array' then v_value else jsonb_build_array(v_value) end) loop
        if not v_options @> jsonb_build_array(v_selected) then
          raise exception using errcode = '22023', message = 'Opcao nao pertence a pergunta.';
        end if;
        if lower(trim(v_selected #>> '{}')) in ('outra','outro','outros') and coalesce(trim(v_answer->>'otherText'), '') = '' then
          raise exception using errcode = '22023', message = 'Especifique a opcao Outra.';
        end if;
      end loop;
    end if;
  end loop;
  update public.nutrition_questionnaire_assignments set answers = answers_value, status = 'Respondido',
    completed_at = now(), updated_at = now() where id = v_assignment.id returning * into v_assignment;
  return to_jsonb(v_assignment);
end;
$$;

revoke all on function public.assign_nutrition_questionnaire(text, uuid) from public, anon;
grant execute on function public.assign_nutrition_questionnaire(text, uuid) to authenticated;
revoke all on function public.student_nutrition_questionnaires(text) from public;
grant execute on function public.student_nutrition_questionnaires(text) to anon, authenticated;
revoke all on function public.submit_nutrition_questionnaire(text, uuid, jsonb) from public;
grant execute on function public.submit_nutrition_questionnaire(text, uuid, jsonb) to anon, authenticated;

commit;
