create table if not exists public.coach_subscriptions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null unique references public.users(id) on delete cascade,
  status text not null default 'trial',
  started_at timestamptz not null default now(),
  first_billing_at timestamptz not null default (now() + interval '1 month'),
  next_billing_at timestamptz not null default (now() + interval '1 month'),
  first_month_price_cents integer not null default 990,
  regular_price_cents integer not null default 4990,
  maintenance_rate numeric(6,5) not null default 0.02,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_subscriptions enable row level security;

drop policy if exists "coach can read own platform subscription" on public.coach_subscriptions;
create policy "coach can read own platform subscription"
on public.coach_subscriptions for select
to authenticated
using (coach_id = auth.uid());

drop policy if exists "coach can update own platform subscription" on public.coach_subscriptions;

insert into public.coach_subscriptions (coach_id, started_at, first_billing_at, next_billing_at)
select
  u.id,
  now(),
  now() + interval '1 month',
  now() + interval '1 month'
from public.users u
on conflict (coach_id) do nothing;

create or replace function public.create_coach_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as '
begin
  insert into public.coach_subscriptions (coach_id)
  values (new.id)
  on conflict (coach_id) do nothing;
  return new;
end;
';

drop trigger if exists create_coach_subscription_after_user on public.users;
create trigger create_coach_subscription_after_user
after insert on public.users
for each row execute function public.create_coach_subscription();

create index if not exists coach_subscriptions_next_billing_idx
  on public.coach_subscriptions (next_billing_at);
