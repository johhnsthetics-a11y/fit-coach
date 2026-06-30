alter table public.messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text;

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "message attachments read" on storage.objects;
drop policy if exists "message attachments insert" on storage.objects;
drop policy if exists "message attachments update" on storage.objects;
drop policy if exists "message attachments delete" on storage.objects;

create policy "message attachments read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'message-attachments');

create policy "message attachments insert"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'message-attachments');

create policy "message attachments update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'message-attachments')
with check (bucket_id = 'message-attachments');

create policy "message attachments delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'message-attachments');

create or replace function public.submit_student_message(
  invite_code text,
  message_body text,
  attachment_url text default null,
  attachment_type text default null,
  attachment_name text default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  active_invite public.student_invites%rowtype;
  saved public.messages%rowtype;
begin
  select * into active_invite
  from public.student_invites
  where code = invite_code
    and status = 'active'
    and expires_at > now()
  limit 1;

  if active_invite.id is null then
    raise exception 'Convite nao encontrado ou expirado';
  end if;

  insert into public.messages (
    coach_id,
    student_id,
    sender,
    body,
    read,
    attachment_url,
    attachment_type,
    attachment_name
  )
  values (
    active_invite.coach_id,
    active_invite.student_id,
    'student',
    coalesce(nullif(message_body, ''), 'Foto enviada'),
    false,
    attachment_url,
    attachment_type,
    attachment_name
  )
  returning * into saved;

  return saved;
end;
$$;

grant execute on function public.submit_student_message(text, text, text, text, text) to anon, authenticated;
