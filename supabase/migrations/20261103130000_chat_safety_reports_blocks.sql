-- Coach Fit Pro / chat safety. Additive, no changes to historical messages,
-- subscriptions, students, nutrition records, commissions or billing.
begin;

create table if not exists public.chat_safety_blocks (
  coach_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  blocked_by text not null check (blocked_by in ('coach','student')),
  created_at timestamptz not null default now(),
  primary key (student_id, blocked_by)
);
create index if not exists chat_safety_blocks_coach_idx
  on public.chat_safety_blocks (coach_id, student_id);
alter table public.chat_safety_blocks enable row level security;
revoke all on public.chat_safety_blocks from public, anon, authenticated;
grant all on public.chat_safety_blocks to service_role;

create table if not exists public.chat_safety_reports (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  reporter_role text not null check (reporter_role in ('coach','student')),
  reason text not null check (reason in ('harassment','spam','sexual_content','privacy','hate_or_abuse','other')),
  details text not null default '' check (char_length(details) <= 500),
  message_excerpt text check (char_length(message_excerpt) <= 240),
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (message_id, reporter_role)
);
create index if not exists chat_safety_reports_review_idx
  on public.chat_safety_reports (status, created_at desc);
alter table public.chat_safety_reports enable row level security;
revoke all on public.chat_safety_reports from public, anon, authenticated;
grant all on public.chat_safety_reports to service_role;

-- Internal identity check: coach's authenticated account, the student's
-- authenticated account, OR the existing active student invite credential.
-- Never accept a user-editable role, coach_id, or email from the client.
create or replace function public.chat_safety_actor(p_student_id uuid, p_invite_code text default null)
returns text language plpgsql security definer set search_path = ''
as $func$
declare
  v_student public.students%rowtype;
  v_uid uuid := (select auth.uid());
begin
  select * into v_student from public.students where id = p_student_id;
  if v_student.id is null then
    raise exception 'Conversa nao encontrada' using errcode = '42501';
  end if;
  if v_uid is not null and v_uid = v_student.coach_id then
    return 'coach';
  end if;
  if v_uid is not null and v_uid = v_student.auth_user_id then
    return 'student';
  end if;
  if nullif(btrim(p_invite_code), '') is not null and exists (
    select 1 from public.student_invites si
    where si.student_id = v_student.id
      and si.coach_id = v_student.coach_id
      and si.code = p_invite_code
      and si.status = 'active' and si.expires_at > now()
  ) then
    return 'student';
  end if;
  raise exception 'Acesso a conversa nao autorizado' using errcode = '42501';
end;
$func$;
revoke all on function public.chat_safety_actor(uuid,text) from public,anon,authenticated;

create or replace function public.chat_safety_status(p_student_id uuid, p_invite_code text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $func$
declare
  v_actor text;
  v_coach_id uuid;
  v_coach_block boolean;
  v_student_block boolean;
begin
  v_actor := public.chat_safety_actor(p_student_id,p_invite_code);
  select coach_id into v_coach_id from public.students where id = p_student_id;
  select
    coalesce(bool_or(blocked_by = 'coach'),false),
    coalesce(bool_or(blocked_by = 'student'),false)
  into v_coach_block,v_student_block
  from public.chat_safety_blocks
  where student_id = p_student_id and coach_id = v_coach_id;
  return jsonb_build_object(
    'blocked',v_coach_block or v_student_block,
    'blockedByYou',case when v_actor='coach' then v_coach_block else v_student_block end,
    'blockedByOther',case when v_actor='coach' then v_student_block else v_coach_block end
  );
end;
$func$;
revoke all on function public.chat_safety_status(uuid,text) from public,anon,authenticated;
grant execute on function public.chat_safety_status(uuid,text) to anon,authenticated;

create or replace function public.chat_safety_set_block(
  p_student_id uuid, p_blocked boolean, p_invite_code text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $func$
declare
  v_actor text;
  v_coach_id uuid;
begin
  v_actor := public.chat_safety_actor(p_student_id,p_invite_code);
  select coach_id into v_coach_id from public.students where id = p_student_id;
  if p_blocked is null then
    raise exception 'Bloqueio invalido' using errcode = '22023';
  end if;
  if p_blocked then
    insert into public.chat_safety_blocks(coach_id,student_id,blocked_by)
    values (v_coach_id,p_student_id,v_actor)
    on conflict (student_id,blocked_by)
    do update set coach_id = excluded.coach_id, created_at = now();
  else
    delete from public.chat_safety_blocks
    where coach_id = v_coach_id and student_id = p_student_id and blocked_by = v_actor;
  end if;
  return public.chat_safety_status(p_student_id,p_invite_code);
end;
$func$;
revoke all on function public.chat_safety_set_block(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.chat_safety_set_block(uuid,boolean,text) to anon,authenticated;

create or replace function public.chat_safety_submit_report(
  p_student_id uuid, p_reason text, p_details text default '',
  p_message_id uuid default null, p_invite_code text default null
) returns uuid language plpgsql security definer set search_path = ''
as $func$
declare
  v_actor text;
  v_coach_id uuid;
  v_sender text;
  v_message_excerpt text;
  v_report_id uuid;
begin
  v_actor := public.chat_safety_actor(p_student_id,p_invite_code);
  if p_reason is null or p_reason not in (
    'harassment','spam','sexual_content','privacy','hate_or_abuse','other'
  ) then
    raise exception 'Motivo de denuncia invalido' using errcode = '22023';
  end if;
  if char_length(coalesce(p_details,'')) > 500 then
    raise exception 'A descricao deve ter no maximo 500 caracteres' using errcode = '22023';
  end if;
  select coach_id into v_coach_id from public.students where id=p_student_id;
  if p_message_id is not null then
    select sender, left(coalesce(body,''),240) into v_sender,v_message_excerpt from public.messages
    where id = p_message_id and student_id=p_student_id and coach_id=v_coach_id;
    if v_sender is null or v_sender = v_actor then
      raise exception 'Mensagem nao pertence ao contato informado' using errcode='42501';
    end if;
  end if;
  if (select count(*) from public.chat_safety_reports
      where student_id=p_student_id and coach_id=v_coach_id and reporter_role=v_actor
        and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Limite de denuncias atingido. Contate o suporte.' using errcode='22023';
  end if;
  insert into public.chat_safety_reports(
    coach_id,student_id,message_id,reporter_role,reason,details,message_excerpt
  ) values (v_coach_id,p_student_id,p_message_id,v_actor,p_reason,coalesce(btrim(p_details),''),v_message_excerpt)
  on conflict (message_id,reporter_role) do update set id = public.chat_safety_reports.id
  returning id into v_report_id;
  return v_report_id;
end;
$func$;
revoke all on function public.chat_safety_submit_report(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.chat_safety_submit_report(uuid,text,text,uuid,text) to anon,authenticated;

-- Master moderation is based on verified auth identity and the existing
-- active admin_users roster, not on client-supplied flags or user_metadata.
create or replace function public.chat_safety_require_master()
returns void language plpgsql security definer set search_path = ''
as $func$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = (select auth.uid()) and a.active = true and a.role = 'master'
  ) then
    raise exception 'Acesso ao painel de denuncias negado' using errcode = '42501';
  end if;
end;
$func$;
revoke all on function public.chat_safety_require_master() from public,anon,authenticated;

create or replace function public.chat_safety_admin_list_reports(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = ''
as $func$
declare v_result jsonb;
begin
  perform public.chat_safety_require_master();
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb)
  into v_result from (
    select c.id, c.created_at, c.status, c.reporter_role,
      c.reason, c.details, c.student_id, c.coach_id,
      st.name as student_name, coalesce(c.message_excerpt,left(coalesce(m.body,''),240)) as message_excerpt
    from public.chat_safety_reports c
    left join public.students st on st.id=c.student_id
    left join public.messages m on m.id=c.message_id
    order by c.created_at desc
    limit least(greatest(coalesce(p_limit,50),1),100)
  ) r;
  return v_result;
end;
$func$;
revoke all on function public.chat_safety_admin_list_reports(integer) from public,anon,authenticated;
grant execute on function public.chat_safety_admin_list_reports(integer) to authenticated;

create or replace function public.chat_safety_admin_update_report(p_report_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path = ''
as $func$
declare v_count integer;
begin
  perform public.chat_safety_require_master();
  if p_status not in ('open','reviewing','resolved') or p_status is null then
    raise exception 'Status invalido' using errcode='22023';
  end if;
  update public.chat_safety_reports
     set status=p_status, reviewed_at=case when p_status='open' then null else now() end
     where id=p_report_id;
  get diagnostics v_count = row_count;
  return v_count=1;
end;
$func$;
revoke all on function public.chat_safety_admin_update_report(uuid,text) from public,anon,authenticated;
grant execute on function public.chat_safety_admin_update_report(uuid,text) to authenticated;

-- Both professional REST inserts and student invite-backed RPC inserts pass
-- through this guard. Old history remains readable. Soft-deletion remains
-- possible, but a blocked user cannot edit message contents to bypass it.
create or replace function public.chat_safety_guard_messages()
returns trigger language plpgsql security definer set search_path = ''
as $func$
begin
  if (tg_op='INSERT' or (
    tg_op='UPDATE' and new.deleted_at is null
    and (new.body is distinct from old.body
      or new.attachment_url is distinct from old.attachment_url
      or new.attachment_type is distinct from old.attachment_type
      or new.attachment_name is distinct from old.attachment_name)
  )) and exists (
    select 1 from public.chat_safety_blocks b
    where b.student_id=new.student_id and b.coach_id=new.coach_id
  ) then
    raise exception 'Chat bloqueado. Desbloqueie para enviar mensagens.'
      using errcode='42501';
  end if;
  return new;
end;
$func$;
revoke all on function public.chat_safety_guard_messages() from public,anon,authenticated;
drop trigger if exists zz_chat_safety_guard_insert on public.messages;
create trigger zz_chat_safety_guard_insert before insert on public.messages
  for each row execute function public.chat_safety_guard_messages();
drop trigger if exists zz_chat_safety_guard_update on public.messages;
create trigger zz_chat_safety_guard_update
  before update of body,attachment_url,attachment_type,attachment_name on public.messages
  for each row execute function public.chat_safety_guard_messages();

commit;
