alter table if exists public.workout_exercises
  add column if not exists muscle_group text,
  add column if not exists equipment text,
  add column if not exists instructions text,
  add column if not exists video_url text;

alter table if exists public.students
  add column if not exists require_anamnesis boolean not null default true,
  add column if not exists cpf text;

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

insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', false)
on conflict (id) do update set public = false;

create index if not exists students_coach_id_idx
  on public.students (coach_id);

create index if not exists checkins_student_id_idx
  on public.checkins (student_id);

create index if not exists checkin_photos_checkin_id_idx
  on public.checkin_photos (checkin_id);

create index if not exists workouts_student_id_idx
  on public.workouts (student_id);

create index if not exists workout_exercises_workout_id_idx
  on public.workout_exercises (workout_id);

create index if not exists workout_logs_student_id_idx
  on public.workout_logs (student_id);

create index if not exists nutrition_plans_student_id_idx
  on public.nutrition_plans (student_id);

create index if not exists nutrition_meals_plan_id_idx
  on public.nutrition_meals (nutrition_plan_id);

create index if not exists messages_student_id_idx
  on public.messages (student_id);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

create index if not exists appointments_student_id_idx
  on public.appointments (student_id);

create index if not exists invoices_student_id_idx
  on public.invoices (student_id);

create index if not exists assessments_student_id_idx
  on public.assessments (student_id);

create index if not exists student_invites_code_idx
  on public.student_invites (code);

create index if not exists student_invites_student_id_idx
  on public.student_invites (student_id);

create index if not exists student_anamneses_student_id_idx
  on public.student_anamneses (student_id);
