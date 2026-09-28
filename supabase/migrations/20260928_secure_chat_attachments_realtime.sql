begin;

alter table public.student_checkout_sessions
  drop constraint if exists student_checkout_sessions_status_check;

alter table public.student_checkout_sessions
  add constraint student_checkout_sessions_status_check
  check (status in ('pending', 'active', 'paid', 'past_due', 'canceled', 'refunded', 'chargeback'));

update storage.buckets
set public = false,
    file_size_limit = 12582912,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav',
      'application/pdf', 'text/plain'
    ]::text[]
where id = 'message-attachments';

drop policy if exists "message attachments read" on storage.objects;
drop policy if exists "message attachments insert" on storage.objects;
drop policy if exists "message attachments update" on storage.objects;
drop policy if exists "message attachments delete" on storage.objects;

drop policy if exists "chat participants receive private broadcasts" on realtime.messages;
create policy "chat participants receive private broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and (
    (
      (select realtime.topic()) = 'chat-coach:' || (select auth.uid())::text
      and coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'chat_actor', '') = 'coach'
    )
    or (
      (select realtime.topic()) = 'chat-student:' || (select auth.uid())::text
      and coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'chat_actor', '') = 'student'
    )
  )
);

create or replace function public.coachfit_broadcast_message_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_coach_id uuid := coalesce(new.coach_id, old.coach_id);
  row_student_id uuid := coalesce(new.student_id, old.student_id);
begin
  perform realtime.broadcast_changes(
    'chat-coach:' || row_coach_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  perform realtime.broadcast_changes(
    'chat-student:' || row_student_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke all on function public.coachfit_broadcast_message_changes() from public, anon, authenticated;

drop trigger if exists coachfit_messages_realtime on public.messages;
create trigger coachfit_messages_realtime
after insert or update or delete on public.messages
for each row execute function public.coachfit_broadcast_message_changes();

commit;
