begin;

create table if not exists public.chat_push_devices (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('coach', 'student')),
  coach_id uuid references public.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  device_token text not null unique,
  platform text not null default 'ios' check (platform = 'ios'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint chat_push_devices_actor_identity_check check (
    (actor_type = 'coach' and coach_id is not null and student_id is null)
    or (actor_type = 'student' and student_id is not null and coach_id is null)
  )
);

create index if not exists chat_push_devices_coach_active_idx
  on public.chat_push_devices (coach_id, active)
  where actor_type = 'coach';

create index if not exists chat_push_devices_student_active_idx
  on public.chat_push_devices (student_id, active)
  where actor_type = 'student';

alter table public.chat_push_devices enable row level security;
revoke all on public.chat_push_devices from public, anon, authenticated;
grant all on public.chat_push_devices to service_role;

create table if not exists public.chat_push_delivery_log (
  message_id uuid primary key references public.messages(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('coach', 'student')),
  recipient_id uuid not null,
  status text not null check (status in ('sending', 'sent', 'failed', 'no_devices')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now()
);

alter table public.chat_push_delivery_log enable row level security;
revoke all on public.chat_push_delivery_log from public, anon, authenticated;
grant all on public.chat_push_delivery_log to service_role;

create or replace function public.claim_chat_push_delivery(
  p_message_id uuid,
  p_recipient_type text,
  p_recipient_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed uuid;
begin
  if p_message_id is null
    or p_recipient_id is null
    or p_recipient_type not in ('coach', 'student') then
    return false;
  end if;

  insert into public.chat_push_delivery_log (
    message_id, recipient_type, recipient_id, status, attempt_count, last_attempt_at, updated_at
  ) values (
    p_message_id, p_recipient_type, p_recipient_id, 'sending', 1, now(), now()
  )
  on conflict (message_id) do update set
    recipient_type = excluded.recipient_type,
    recipient_id = excluded.recipient_id,
    status = 'sending',
    attempt_count = public.chat_push_delivery_log.attempt_count + 1,
    last_attempt_at = now(),
    delivered_at = null,
    last_error_code = null,
    updated_at = now()
  where public.chat_push_delivery_log.status = 'failed'
     or (
       public.chat_push_delivery_log.status = 'sending'
       and public.chat_push_delivery_log.last_attempt_at < now() - interval '2 minutes'
     )
  returning message_id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function public.claim_chat_push_delivery(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_chat_push_delivery(uuid, text, uuid) to service_role;

commit;
