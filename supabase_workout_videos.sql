alter table public.workout_exercises
  add column if not exists muscle_group text,
  add column if not exists equipment text,
  add column if not exists instructions text,
  add column if not exists video_url text;
