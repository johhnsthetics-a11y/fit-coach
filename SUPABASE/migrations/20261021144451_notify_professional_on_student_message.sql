begin;

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
  if message_row.sender is distinct from 'student' then
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
    user_id,
    title,
    body,
    read,
    event_type,
    entity_id,
    student_id
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

commit;
