-- Atualizacao para integrar a biblioteca de exercicios com AscendAPI / RapidAPI.
-- Rode este SQL depois do supabase_exercise_library.sql.

create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text not null default '',
  equipment text default '',
  instructions text default '',
  video_url text default '',
  thumbnail_url text default '',
  muscle_map text default '',
  aliases text[] default '{}',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.exercise_library
  add column if not exists external_id text,
  add column if not exists image_url text,
  add column if not exists source_payload jsonb default '{}'::jsonb,
  add column if not exists provider text default 'coachfit';

alter table public.workout_exercises
  add column if not exists external_id text,
  add column if not exists image_url text;

create index if not exists exercise_library_external_id_idx
on public.exercise_library (external_id);

create index if not exists exercise_library_name_idx
on public.exercise_library (name);

alter table public.exercise_library enable row level security;

drop policy if exists "exercise library public read" on public.exercise_library;
drop policy if exists "exercise library admin manage" on public.exercise_library;

create policy "exercise library public read"
on public.exercise_library for select
to anon, authenticated
using (active = true);

create policy "exercise library admin manage"
on public.exercise_library for all
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'sac@coachfitpro.com.br',
    'admin@coachfitpro.com.br',
    'john@coachfitpro.com.br',
    'johhnsthetics@gmail.com'
  )
);

