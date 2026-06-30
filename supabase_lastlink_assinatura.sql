alter table public.coach_subscriptions
  add column if not exists provider text default 'lastlink',
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_order_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists current_period_started_at timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists checkout_first_month_url text default 'https://lastlink.com/p/C4CB65A32/checkout-payment',
  add column if not exists checkout_regular_url text default 'https://lastlink.com/p/C62358952/checkout-payment';

update public.coach_subscriptions
set
  provider = coalesce(provider, 'lastlink'),
  checkout_first_month_url = coalesce(checkout_first_month_url, 'https://lastlink.com/p/C4CB65A32/checkout-payment'),
  checkout_regular_url = coalesce(checkout_regular_url, 'https://lastlink.com/p/C62358952/checkout-payment')
where provider is null
   or checkout_first_month_url is null
   or checkout_regular_url is null;

create index if not exists coach_subscriptions_provider_subscription_idx
  on public.coach_subscriptions (provider_subscription_id);

create index if not exists coach_subscriptions_provider_order_idx
  on public.coach_subscriptions (provider_order_id);

create table if not exists public.lastlink_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  event_type text,
  buyer_email text,
  provider_order_id text,
  provider_subscription_id text,
  subscription_status text,
  processed boolean not null default false,
  processing_error text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.lastlink_webhook_events enable row level security;

create index if not exists lastlink_webhook_events_email_idx
  on public.lastlink_webhook_events (buyer_email);

create index if not exists lastlink_webhook_events_received_idx
  on public.lastlink_webhook_events (received_at desc);
