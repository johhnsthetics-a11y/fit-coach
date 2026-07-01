alter table public.coach_settings
  add column if not exists billing_logo_url text,
  add column if not exists billing_primary_color text default '#10b981',
  add column if not exists billing_accent_color text default '#0f172a',
  add column if not exists billing_message text,
  add column if not exists custom_plans jsonb default '[]'::jsonb;

comment on column public.coach_settings.billing_logo_url is
  'Logo usada na tela de cobrança do aluno.';

comment on column public.coach_settings.billing_primary_color is
  'Cor principal da cobrança personalizada do treinador.';

comment on column public.coach_settings.billing_accent_color is
  'Cor de apoio da cobrança personalizada do treinador.';

comment on column public.coach_settings.billing_message is
  'Mensagem de cobrança com variáveis: {aluno}, {valor}, {vencimento}, {pix}, {whatsapp}, {email}.';

comment on column public.coach_settings.custom_plans is
  'Lista de planos próprios do treinador em JSON.';
