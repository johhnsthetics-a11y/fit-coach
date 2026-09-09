-- Coach Fit Pro
-- Fix scoped RLS policies for nutrition plan and meal persistence.
-- Apply manually in Supabase after reviewing the table names/foreign keys.

alter table if exists public.nutrition_plans enable row level security;
alter table if exists public.nutrition_meals enable row level security;

grant select, insert, update, delete on public.nutrition_plans to authenticated;
grant select, insert, update, delete on public.nutrition_meals to authenticated;

create or replace function public.coachfit_owns_student(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students
    where students.id = target_student_id
      and students.coach_id = auth.uid()
  );
$$;

revoke all on function public.coachfit_owns_student(uuid) from public;
grant execute on function public.coachfit_owns_student(uuid) to authenticated;

create or replace function public.save_nutrition_plan(plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := auth.uid();
  v_plan_id uuid := nullif(plan->>'id', '')::uuid;
  v_student_id uuid := nullif(plan->>'student_id', '')::uuid;
  v_saved_plan public.nutrition_plans%rowtype;
  v_saved_meal public.nutrition_meals%rowtype;
  v_meal jsonb;
  v_saved_meals jsonb := '[]'::jsonb;
  v_order_index integer := 0;
begin
  if v_coach_id is null then
    raise exception 'Sessão do treinador não identificada.' using errcode = '42501';
  end if;

  if v_student_id is null or not public.coachfit_owns_student(v_student_id) then
    raise exception 'Aluno não pertence ao treinador autenticado.' using errcode = '42501';
  end if;

  if v_plan_id is not null then
    update public.nutrition_plans
       set title = coalesce(plan->>'title', title),
           calories = coalesce(plan->>'calories', calories),
           protein = coalesce(plan->>'protein', protein),
           notes = coalesce(plan->>'notes', notes),
           active = true
     where id = v_plan_id
       and coach_id = v_coach_id
       and student_id = v_student_id
     returning * into v_saved_plan;

    if not found then
      raise exception 'Dieta não encontrada para este treinador.' using errcode = '42501';
    end if;

    delete from public.nutrition_meals
     where nutrition_plan_id = v_saved_plan.id;
  else
    insert into public.nutrition_plans (
      coach_id,
      student_id,
      title,
      calories,
      protein,
      notes,
      active
    ) values (
      v_coach_id,
      v_student_id,
      coalesce(plan->>'title', 'Plano alimentar'),
      coalesce(plan->>'calories', ''),
      coalesce(plan->>'protein', ''),
      coalesce(plan->>'notes', ''),
      true
    )
    returning * into v_saved_plan;
  end if;

  for v_meal in
    select value
    from jsonb_array_elements(coalesce(plan->'meals', '[]'::jsonb))
  loop
    insert into public.nutrition_meals (
      nutrition_plan_id,
      name,
      foods,
      macros,
      time_label,
      order_index
    ) values (
      v_saved_plan.id,
      coalesce(v_meal->>'name', ''),
      coalesce(v_meal->>'foods', ''),
      coalesce(v_meal->>'macros', ''),
      coalesce(v_meal->>'time', ''),
      coalesce(nullif(v_meal->>'order_index', '')::integer, v_order_index)
    )
    returning * into v_saved_meal;

    v_saved_meals := v_saved_meals || jsonb_build_array(to_jsonb(v_saved_meal));

    v_order_index := v_order_index + 1;
  end loop;

  return to_jsonb(v_saved_plan) || jsonb_build_object('nutrition_meals', v_saved_meals);
end;
$$;

revoke all on function public.save_nutrition_plan(jsonb) from public;
grant execute on function public.save_nutrition_plan(jsonb) to authenticated;

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
  and public.coachfit_owns_student(student_id)
);

create policy "nutrition_plans_update_own_coach"
on public.nutrition_plans
for update
to authenticated
using (coach_id = auth.uid())
with check (
  coach_id = auth.uid()
  and public.coachfit_owns_student(student_id)
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
