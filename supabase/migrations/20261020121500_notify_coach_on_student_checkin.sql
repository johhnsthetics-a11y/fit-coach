begin;

do $$
begin
  if to_regprocedure('public.submit_student_checkin_with_financial_access(text,text,text,text,text,text)') is null then
    if to_regprocedure('public.submit_student_checkin(text,text,text,text,text,text)') is null then
      raise exception 'Funcao submit_student_checkin nao encontrada.';
    end if;
    alter function public.submit_student_checkin(text, text, text, text, text, text)
      rename to submit_student_checkin_with_financial_access;
  end if;
end;
$$;

revoke all on function public.submit_student_checkin_with_financial_access(text, text, text, text, text, text)
from public, anon, authenticated;

create or replace function public.submit_student_checkin(
  invite_code text,
  checkin_type text,
  due_label text,
  checkin_state text,
  weight_value text,
  note_value text
)
returns public.checkins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saved public.checkins%rowtype;
  v_coach_id uuid;
  v_student_name text;
begin
  select *
  into v_saved
  from public.submit_student_checkin_with_financial_access(
    invite_code,
    checkin_type,
    due_label,
    checkin_state,
    weight_value,
    note_value
  );

  select invites.coach_id, students.name
  into v_coach_id, v_student_name
  from public.student_invites as invites
  join public.students as students
    on students.id = invites.student_id
   and students.coach_id = invites.coach_id
  where invites.code = trim(invite_code)
    and invites.student_id = v_saved.student_id
    and invites.status = 'active'
    and (invites.expires_at is null or invites.expires_at > now())
  order by invites.created_at desc
  limit 1;

  if v_coach_id is not null then
    insert into public.notifications (user_id, title, body, read)
    values (
      v_coach_id,
      'Novo check-in recebido',
      coalesce(nullif(v_student_name, ''), 'O aluno') || ' enviou um novo check-in.',
      false
    );
  end if;

  return v_saved;
end;
$$;

revoke all on function public.submit_student_checkin(text, text, text, text, text, text) from public;
grant execute on function public.submit_student_checkin(text, text, text, text, text, text) to anon, authenticated;

commit;
