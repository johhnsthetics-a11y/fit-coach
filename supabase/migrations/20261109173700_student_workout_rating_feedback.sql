begin;

alter table public.workout_logs
  add column if not exists rating_feedback text not null default '';

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_logs_rating_feedback_length_check'
      and conrelid = 'public.workout_logs'::regclass
  ) then
    alter table public.workout_logs
      add constraint workout_logs_rating_feedback_length_check
      check (char_length(rating_feedback) <= 500);
  end if;
end
$constraint$;

-- A função antiga continua ativa para clientes anteriores. A nova função
-- reaproveita sua validação de convite, financeiro e log concluído, e grava
-- o texto na mesma transação.
create or replace function public.rate_student_workout_log_with_feedback(
  invite_code text,
  selected_workout_log_id uuid,
  rating_value smallint,
  feedback_value text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saved_log jsonb;
  v_saved_log_id uuid;
  v_log public.workout_logs%rowtype;
begin
  v_saved_log := public.rate_student_workout_log(
    rate_student_workout_log_with_feedback.invite_code,
    rate_student_workout_log_with_feedback.selected_workout_log_id,
    rate_student_workout_log_with_feedback.rating_value
  );
  v_saved_log_id := nullif(v_saved_log ->> 'id', '')::uuid;

  if v_saved_log_id is null
     or v_saved_log_id <> rate_student_workout_log_with_feedback.selected_workout_log_id then
    raise exception 'O servidor nao confirmou a avaliacao do treino.' using errcode = '42501';
  end if;

  update public.workout_logs as logs
  set rating_feedback = left(btrim(coalesce(rate_student_workout_log_with_feedback.feedback_value, '')), 500)
  where logs.id = v_saved_log_id
  returning logs.* into v_log;

  if v_log.id is null then
    raise exception 'Treino concluido nao encontrado para salvar o feedback.' using errcode = '42501';
  end if;

  return to_jsonb(v_log);
end;
$$;

revoke all on function public.rate_student_workout_log_with_feedback(text, uuid, smallint, text) from public;
grant execute on function public.rate_student_workout_log_with_feedback(text, uuid, smallint, text) to anon, authenticated;

commit;
