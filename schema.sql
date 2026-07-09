-- BASE LEGADA / NAO EXECUTAR SOZINHO EM PRODUCAO
-- Este schema cria tabelas base, mas nao aplica todas as politicas atuais do app.
-- Depois dele, e obrigatorio aplicar a ordem oficial em SUPABASE-PRODUCTION-SQL-ORDER.md.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text default 'coach',
  created_at timestamptz default now()
);

create table if not exists coach_subscriptions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null unique references users(id) on delete cascade,
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

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  cpf text,
  goal text,
  phase text,
  status text default 'Em dia',
  adherence numeric default 0,
  risk text default 'Baixo',
  plan text default 'Essential',
  payment text default 'Pendente',
  weight text,
  body_fat text,
  calories text,
  protein text,
  workout text,
  next_checkin text,
  last_message text,
  require_anamnesis boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents integer not null,
  features text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  plan_id uuid references plans(id),
  status text default 'active',
  payment_status text default 'Pendente',
  next_billing_date date,
  created_at timestamptz default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id) on delete cascade,
  amount_cents integer not null,
  status text not null,
  provider text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  type text,
  due_label text,
  state text default 'Pendente',
  weight text,
  note text,
  created_at timestamptz default now()
);

create table if not exists checkin_photos (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid references checkins(id) on delete cascade,
  storage_url text not null,
  label text,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);

insert into plans (name, price_cents, features)
values
  ('Essential', 19700, 'Treino, dieta e 1 check-in semanal'),
  ('Performance', 34700, 'Ajustes semanais, suporte e analise de videos'),
  ('Elite', 59700, 'Acompanhamento premium, chamadas e revisoes completas')
on conflict do nothing;

alter table users enable row level security;
alter table students enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table checkins enable row level security;
alter table checkin_photos enable row level security;
alter table notifications enable row level security;

-- As politicas abertas do prototipo foram removidas por seguranca.
-- Depois deste schema, rode supabase_auth_security.sql para aplicar o acesso por treinador.
drop policy if exists "prototype users access" on users;
drop policy if exists "prototype students access" on students;
drop policy if exists "prototype plans access" on plans;
drop policy if exists "prototype subscriptions access" on subscriptions;
drop policy if exists "prototype payments access" on payments;
drop policy if exists "prototype checkins access" on checkins;
drop policy if exists "prototype checkin photos access" on checkin_photos;
drop policy if exists "prototype notifications access" on notifications;
