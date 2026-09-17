create or replace function public.update_student_message(
  invite_code text,
  selected_message_id uuid,
  message_body text
)
returns public.messages
language plpgsql
security definer
set search_path = public, pg_temp
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

  if nullif(btrim(message_body), '') is null then
    raise exception 'A mensagem nao pode ficar vazia';
  end if;

  update public.messages
  set body = btrim(message_body)
  where id = selected_message_id
    and student_id = active_invite.student_id
    and coach_id = active_invite.coach_id
    and sender = 'student'
  returning * into saved;

  if saved.id is null then
    raise exception 'Mensagem nao encontrada ou sem permissao';
  end if;

  return saved;
end;
$$;

create or replace function public.delete_student_message(
  invite_code text,
  selected_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_invite public.student_invites%rowtype;
  deleted_count integer := 0;
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

  delete from public.messages
  where id = selected_message_id
    and student_id = active_invite.student_id
    and coach_id = active_invite.coach_id
    and sender = 'student';

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.update_student_message(text, uuid, text) from public;
revoke all on function public.delete_student_message(text, uuid) from public;
grant execute on function public.update_student_message(text, uuid, text) to anon, authenticated;
grant execute on function public.delete_student_message(text, uuid) to anon, authenticated;
