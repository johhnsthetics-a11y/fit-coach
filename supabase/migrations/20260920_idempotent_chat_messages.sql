-- Preserve a single student message when a network retry repeats the same request.
drop function if exists public.submit_student_message(text, text, text, text, text);

create or replace function public.submit_student_message(
  invite_code text,
  message_body text,
  attachment_url text default null,
  attachment_type text default null,
  attachment_name text default null,
  client_message_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_invite public.student_invites%rowtype;
  saved public.messages%rowtype;
  requested_id uuid := coalesce(client_message_id, gen_random_uuid());
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
    id,
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
    requested_id,
    active_invite.coach_id,
    active_invite.student_id,
    'student',
    coalesce(nullif(message_body, ''), 'Foto enviada'),
    false,
    attachment_url,
    attachment_type,
    attachment_name
  )
  on conflict (id) do nothing
  returning * into saved;

  if saved.id is null then
    select * into saved
    from public.messages
    where id = requested_id;

    if saved.id is null
      or saved.coach_id <> active_invite.coach_id
      or saved.student_id <> active_invite.student_id
      or saved.sender <> 'student' then
      raise exception 'Mensagem nao pertence a este convite' using errcode = '42501';
    end if;
  end if;

  return saved;
end;
$$;

revoke all on function public.submit_student_message(text, text, text, text, text, uuid) from public;
grant execute on function public.submit_student_message(text, text, text, text, text, uuid) to anon, authenticated;
