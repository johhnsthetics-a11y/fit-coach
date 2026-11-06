begin;

alter table public.students
  add column if not exists notify_coach_on_workout_finish boolean not null default true;

comment on column public.students.notify_coach_on_workout_finish is
  'Permite ao treinador receber notificações quando este aluno conclui ou encerra uma sessão de treino.';

alter table public.messages
  add column if not exists message_kind text not null default 'chat';

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'messages_message_kind_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_message_kind_check
      check (message_kind in ('chat', 'workout_completion'));
  end if;
end;
$$;

alter table public.notifications
  add column if not exists event_type text,
  add column if not exists entity_id uuid,
  add column if not exists student_id uuid references public.students(id) on delete cascade;

create unique index if not exists notifications_event_entity_unique_idx
  on public.notifications (event_type, entity_id)
  where event_type is not null and entity_id is not null;

create index if not exists notifications_student_id_idx
  on public.notifications (student_id)
  where student_id is not null;

create or replace function public.set_student_workout_message_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Clients cannot label their own messages as system events; only the dedicated
  -- server RPC sets this transaction-local marker before inserting the row.
  if pg_catalog.current_setting('coachfit.workout_completion_event', true) = 'true' then
    new.message_kind := 'workout_completion';
  else
    new.message_kind := 'chat';
  end if;
  return new;
end;
$$;

revoke all on function public.set_student_workout_message_kind()
from public, anon, authenticated;

drop trigger if exists messages_set_workout_kind_before_insert on public.messages;
create trigger messages_set_workout_kind_before_insert
before insert on public.messages
for each row
execute function public.set_student_workout_message_kind();

create or replace function public.submit_student_workout_completion_message(
  invite_code text,
  message_body text,
  client_message_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.set_config('coachfit.workout_completion_event', 'true', true);
  return public.submit_student_message(
    invite_code,
    message_body,
    null,
    null,
    null,
    client_message_id
  );
end;
$$;

revoke all on function public.submit_student_workout_completion_message(text, text, uuid)
from public;
grant execute on function public.submit_student_workout_completion_message(text, text, uuid)
to anon, authenticated;

create table if not exists public.workout_completion_push_delivery_log (
  workout_log_id uuid primary key references public.workout_logs(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('sending', 'sent', 'failed', 'no_devices', 'disabled')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now()
);

create index if not exists workout_completion_push_delivery_coach_idx
  on public.workout_completion_push_delivery_log (coach_id, status);

alter table public.workout_completion_push_delivery_log enable row level security;
revoke all on public.workout_completion_push_delivery_log from public, anon, authenticated;
grant all on public.workout_completion_push_delivery_log to service_role;

create or replace function public.claim_workout_completion_push_delivery(
  p_workout_log_id uuid,
  p_coach_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed uuid;
begin
  if p_workout_log_id is null or p_coach_id is null then
    return false;
  end if;

  insert into public.workout_completion_push_delivery_log (
    workout_log_id, coach_id, status, attempt_count, last_attempt_at, updated_at
  ) values (
    p_workout_log_id, p_coach_id, 'sending', 1, now(), now()
  )
  on conflict (workout_log_id) do update set
    coach_id = excluded.coach_id,
    status = 'sending',
    attempt_count = public.workout_completion_push_delivery_log.attempt_count + 1,
    last_attempt_at = now(),
    delivered_at = null,
    last_error_code = null,
    updated_at = now()
  where public.workout_completion_push_delivery_log.status = 'failed'
     or (
       public.workout_completion_push_delivery_log.status = 'sending'
       and public.workout_completion_push_delivery_log.last_attempt_at < now() - interval '2 minutes'
     )
  returning workout_log_id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function public.claim_workout_completion_push_delivery(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.claim_workout_completion_push_delivery(uuid, uuid)
to service_role;

create or replace function public.notify_professional_on_student_message(message_row public.messages)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_name text;
  v_message_preview text;
begin
  if message_row.sender is distinct from 'student'
    or message_row.message_kind = 'workout_completion' then
    return;
  end if;

  select students.name
  into v_student_name
  from public.students as students
  where students.id = message_row.student_id
    and students.coach_id = message_row.coach_id;

  if v_student_name is null then
    return;
  end if;

  v_message_preview := left(regexp_replace(coalesce(message_row.body, ''), E'\\s+', ' ', 'g'), 140);
  if nullif(btrim(v_message_preview), '') is null then
    v_message_preview := 'Nova mensagem no chat.';
  end if;

  insert into public.notifications (
    user_id, title, body, read, event_type, entity_id, student_id
  ) values (
    message_row.coach_id,
    'Nova mensagem recebida',
    v_student_name || ': ' || btrim(v_message_preview),
    false,
    'student_message',
    message_row.id,
    message_row.student_id
  )
  on conflict (event_type, entity_id)
    where event_type is not null and entity_id is not null
  do nothing;
end;
$$;

revoke all on function public.notify_professional_on_student_message(public.messages)
from public, anon, authenticated;

create or replace function public.handle_student_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_professional_on_student_message(new);
  return new;
end;
$$;

revoke all on function public.handle_student_message_notification()
from public, anon, authenticated;

drop trigger if exists messages_notify_professional_after_insert on public.messages;
create trigger messages_notify_professional_after_insert
after insert on public.messages
for each row
when (new.sender = 'student')
execute function public.handle_student_message_notification();

create or replace function public.notify_professional_on_student_workout_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_name text;
  v_notify_coach boolean;
  v_workout_title text;
begin
  if new.student_id is null or new.coach_id is null then
    return new;
  end if;

  -- Only server-stamped student completion/early-end RPC rows create this alert.
  if pg_catalog.strpos(coalesce(new.notes, ''), '[coachfitpro-completion:') = 0
    and pg_catalog.strpos(coalesce(new.notes, ''), '[coachfitpro-ended-early:') = 0 then
    return new;
  end if;

  select students.name, coalesce(students.notify_coach_on_workout_finish, true)
  into v_student_name, v_notify_coach
  from public.students as students
  where students.id = new.student_id
    and students.coach_id = new.coach_id;

  if v_student_name is null or not v_notify_coach then
    return new;
  end if;

  v_workout_title := coalesce(nullif(btrim(new.title), ''), 'treino');

  insert into public.notifications (
    user_id, title, body, read, event_type, entity_id, student_id
  ) values (
    new.coach_id,
    'Treino encerrado',
    v_student_name || ' encerrou ' || v_workout_title || '.',
    false,
    'student_workout_finished',
    new.id,
    new.student_id
  )
  on conflict (event_type, entity_id)
    where event_type is not null and entity_id is not null
  do nothing;

  return new;
end;
$$;

revoke all on function public.notify_professional_on_student_workout_log()
from public, anon, authenticated;

drop trigger if exists workout_logs_notify_professional_after_student_finish on public.workout_logs;
create trigger workout_logs_notify_professional_after_student_finish
after insert on public.workout_logs
for each row
execute function public.notify_professional_on_student_workout_log();

commit;
