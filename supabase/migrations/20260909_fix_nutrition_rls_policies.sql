-- Coach Fit Pro
-- Fix scoped RLS policies for nutrition plan and meal persistence.
-- Apply manually in Supabase after reviewing the table names/foreign keys.

alter table if exists public.nutrition_plans enable row level security;
alter table if exists public.nutrition_meals enable row level security;

grant select, insert, update, delete on public.nutrition_plans to authenticated;
grant select, insert, update, delete on public.nutrition_meals to authenticated;

drop policy if exists "nutrition_plans_select_own_coach" on public.nutrition_plans;
drop policy if exists "nutrition_plans_insert_own_student" on public.nutrition_plans;
drop policy if exists "nutrition_plans_update_own_coach" on public.nutrition_plans;
drop policy if exists "nutrition_plans_delete_own_coach" on public.nutrition_plans;

create policy "nutrition_plans_select_own_coach"
on public.nutrition_plans
for select
to authenticated
using (coach_id = auth.uid());

create policy "nutrition_plans_insert_own_student"
on public.nutrition_plans
for insert
to authenticated
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.students
    where students.id = nutrition_plans.student_id
      and students.coach_id = auth.uid()
  )
);

create policy "nutrition_plans_update_own_coach"
on public.nutrition_plans
for update
to authenticated
using (coach_id = auth.uid())
with check (
  coach_id = auth.uid()
  and exists (
    select 1
    from public.students
    where students.id = nutrition_plans.student_id
      and students.coach_id = auth.uid()
  )
);

create policy "nutrition_plans_delete_own_coach"
on public.nutrition_plans
for delete
to authenticated
using (coach_id = auth.uid());

drop policy if exists "nutrition_meals_select_own_plan" on public.nutrition_meals;
drop policy if exists "nutrition_meals_insert_own_plan" on public.nutrition_meals;
drop policy if exists "nutrition_meals_update_own_plan" on public.nutrition_meals;
drop policy if exists "nutrition_meals_delete_own_plan" on public.nutrition_meals;

create policy "nutrition_meals_select_own_plan"
on public.nutrition_meals
for select
to authenticated
using (
  exists (
    select 1
    from public.nutrition_plans
    where nutrition_plans.id = nutrition_meals.nutrition_plan_id
      and nutrition_plans.coach_id = auth.uid()
  )
);

create policy "nutrition_meals_insert_own_plan"
on public.nutrition_meals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.nutrition_plans
    where nutrition_plans.id = nutrition_meals.nutrition_plan_id
      and nutrition_plans.coach_id = auth.uid()
  )
);

create policy "nutrition_meals_update_own_plan"
on public.nutrition_meals
for update
to authenticated
using (
  exists (
    select 1
    from public.nutrition_plans
    where nutrition_plans.id = nutrition_meals.nutrition_plan_id
      and nutrition_plans.coach_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.nutrition_plans
    where nutrition_plans.id = nutrition_meals.nutrition_plan_id
      and nutrition_plans.coach_id = auth.uid()
  )
);

create policy "nutrition_meals_delete_own_plan"
on public.nutrition_meals
for delete
to authenticated
using (
  exists (
    select 1
    from public.nutrition_plans
    where nutrition_plans.id = nutrition_meals.nutrition_plan_id
      and nutrition_plans.coach_id = auth.uid()
  )
);
