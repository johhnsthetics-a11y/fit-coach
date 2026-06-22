create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text default 'coach',
  created_at timestamptz default now()
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

create policy "prototype users access" on users for all using (true) with check (true);
create policy "prototype students access" on students for all using (true) with check (true);
create policy "prototype plans access" on plans for all using (true) with check (true);
create policy "prototype subscriptions access" on subscriptions for all using (true) with check (true);
create policy "prototype payments access" on payments for all using (true) with check (true);
create policy "prototype checkins access" on checkins for all using (true) with check (true);
create policy "prototype checkin photos access" on checkin_photos for all using (true) with check (true);
create policy "prototype notifications access" on notifications for all using (true) with check (true);
