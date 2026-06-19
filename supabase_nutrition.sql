create table if not exists nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references users(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  title text not null,
  calories text,
  protein text,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  nutrition_plan_id uuid references nutrition_plans(id) on delete cascade,
  name text not null,
  foods text,
  macros text,
  time_label text,
  order_index integer default 0,
  created_at timestamptz default now()
);

alter table nutrition_plans enable row level security;
alter table nutrition_meals enable row level security;

drop policy if exists "coach can manage own nutrition plans" on nutrition_plans;
drop policy if exists "coach can manage own nutrition meals" on nutrition_meals;
drop policy if exists "student invite can read nutrition plans" on nutrition_plans;
drop policy if exists "student invite can read nutrition meals" on nutrition_meals;

create policy "coach can manage own nutrition plans"
on nutrition_plans for all
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "coach can manage own nutrition meals"
on nutrition_meals for all
to authenticated
using (
  exists (
    select 1
    from nutrition_plans
    where nutrition_plans.id = nutrition_meals.nutrition_plan_id
      and nutrition_plans.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from nutrition_plans
    where nutrition_plans.id = nutrition_meals.nutrition_plan_id
      and nutrition_plans.coach_id = auth.uid()
  )
);

create policy "student invite can read nutrition plans"
on nutrition_plans for select
to anon, authenticated
using (
  exists (
    select 1
    from student_invites
    where student_invites.student_id = nutrition_plans.student_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);

create policy "student invite can read nutrition meals"
on nutrition_meals for select
to anon, authenticated
using (
  exists (
    select 1
    from nutrition_plans
    join student_invites on student_invites.student_id = nutrition_plans.student_id
    where nutrition_plans.id = nutrition_meals.nutrition_plan_id
      and student_invites.status = 'active'
      and student_invites.expires_at > now()
  )
);
