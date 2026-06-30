create or replace function public.get_student_messages(invite_code text)
returns setof public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  active_invite public.student_invites%rowtype;
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

  return query
  select m.*
  from public.messages m
  where m.student_id = active_invite.student_id
  order by m.created_at desc;
end;
$$;

grant execute on function public.get_student_messages(text) to anon, authenticated;
