alter table public.students
  add column if not exists water_goal_ml numeric default 2500;

update public.students
set water_goal_ml = 2500
where water_goal_ml is null;
