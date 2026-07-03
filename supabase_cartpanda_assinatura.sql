alter table public.coach_subscriptions
  add column if not exists provider text default 'cartpanda',
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_order_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists current_period_started_at timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists checkout_first_month_url text,
  add column if not exists checkout_regular_url text;

alter table public.coach_subscriptions
  alter column provider set default 'cartpanda';

update public.coach_subscriptions
set
  provider = coalesce(provider, 'cartpanda'),
  updated_at = now()
where provider is null;

create index if not exists coach_subscriptions_provider_subscription_idx
  on public.coach_subscriptions (provider_subscription_id);

create index if not exists coach_subscriptions_provider_order_idx
  on public.coach_subscriptions (provider_order_id);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cartpanda',
  event_id text unique,
  event_type text,
  buyer_email text,
  provider_order_id text,
  provider_subscription_id text,
  product_id text,
  product_name text,
  amount_cents integer,
  subscription_status text,
  processed boolean not null default false,
  processing_error text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.payment_webhook_events enable row level security;

create index if not exists payment_webhook_events_provider_idx
  on public.payment_webhook_events (provider);

create index if not exists payment_webhook_events_email_idx
  on public.payment_webhook_events (buyer_email);

create index if not exists payment_webhook_events_order_idx
  on public.payment_webhook_events (provider_order_id);

create index if not exists payment_webhook_events_received_idx
  on public.payment_webhook_events (received_at desc);

create or replace view public.cartpanda_webhook_events as
select *
from public.payment_webhook_events
where provider = 'cartpanda';
