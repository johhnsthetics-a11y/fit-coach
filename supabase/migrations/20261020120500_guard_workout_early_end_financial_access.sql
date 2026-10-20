begin;

do $$
begin
  if to_regprocedure('public.end_student_workout_session_unchecked(text,uuid,text,text,text,text,integer,jsonb)') is null then
    if to_regprocedure('public.end_student_workout_session(text,uuid,text,text,text,text,integer,jsonb)') is null then
      raise exception 'Funcao end_student_workout_session nao encontrada.';
    end if;
    alter function public.end_student_workout_session(text, uuid, text, text, text, text, integer, jsonb)
      rename to end_student_workout_session_unchecked;
  end if;
end;
$$;

revoke all on function public.end_student_workout_session_unchecked(text, uuid, text, text, text, text, integer, jsonb)
from public, anon, authenticated;

create or replace function public.end_student_workout_session(
  invite_code text,
  selected_workout_id uuid,
  workout_title text,
  effort_value text,
  notes_value text,
  completion_token text,
  duration_seconds_value integer,
  execution_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coachfit_student_financial_access_by_invite(invite_code) then
    raise exception 'Acesso financeiro pendente.' using errcode = '42501';
  end if;

  return public.end_student_workout_session_unchecked(
    invite_code,
    selected_workout_id,
    workout_title,
    effort_value,
    notes_value,
    completion_token,
    duration_seconds_value,
    execution_value
  );
end;
$$;

revoke all on function public.end_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) from public;
grant execute on function public.end_student_workout_session(text, uuid, text, text, text, text, integer, jsonb) to anon, authenticated;

commit;
