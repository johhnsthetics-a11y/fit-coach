create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  email text,
  plan_id text,
  attribution jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_events_created_at_idx
  on public.lead_events (created_at desc);

create index if not exists lead_events_event_type_idx
  on public.lead_events (event_type);

alter table public.lead_events enable row level security;

drop policy if exists "lead_events_public_insert" on public.lead_events;
create policy "lead_events_public_insert"
on public.lead_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "lead_events_master_admin_read" on public.lead_events;
create policy "lead_events_master_admin_read"
on public.lead_events
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) like '%@coachfitpro.com.br'
);
