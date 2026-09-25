begin;

create or replace view public.cartpanda_webhook_events
with (security_invoker = true) as
select *
from public.payment_webhook_events
where provider = 'cartpanda';

revoke all on public.cartpanda_webhook_events from anon, authenticated;
revoke all on public.payment_webhook_events from anon, authenticated;

commit;
