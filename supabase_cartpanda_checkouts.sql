alter table public.coach_subscriptions
  add column if not exists checkout_monthly_url text,
  add column if not exists checkout_semester_url text,
  add column if not exists checkout_annual_url text;

update public.coach_subscriptions
set
  provider = 'cartpanda',
  checkout_first_month_url = 'https://pagamento.coachfitpro.com.br/checkout/211362994:1?subscription=4475',
  checkout_regular_url = 'https://pagamento.coachfitpro.com.br/checkout/211362994:1?subscription=4475',
  checkout_monthly_url = 'https://pagamento.coachfitpro.com.br/checkout/211362994:1?subscription=4475',
  checkout_semester_url = 'https://pagamento.coachfitpro.com.br/checkout/211373219:1?subscription=4479',
  checkout_annual_url = 'https://pagamento.coachfitpro.com.br/checkout/211363657:1?subscription=4476',
  updated_at = now();
