alter table if exists public.workout_exercises
  add column if not exists muscle_group text,
  add column if not exists equipment text,
  add column if not exists instructions text,
  add column if not exists video_url text;

alter table if exists public.students
  add column if not exists require_anamnesis boolean not null default true,
  add column if not exists cpf text;

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
