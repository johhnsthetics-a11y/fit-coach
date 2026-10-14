import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migrationUrl = new URL('../supabase/migrations/20261014120000_fix_student_anamnesis_return_shape.sql', import.meta.url)
const mirrorMigrationUrl = new URL('../SUPABASE/migrations/20261014120000_fix_student_anamnesis_return_shape.sql', import.meta.url)

test('student login anamnesis RPC keeps matching the expanded table row type', async () => {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create table public.students(id uuid primary key);
    create table public.student_invites(
      id uuid primary key,
      student_id uuid not null references public.students(id),
      code text not null,
      status text not null,
      expires_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table public.student_anamneses(
      id uuid primary key,
      coach_id uuid not null,
      student_id uuid not null references public.students(id),
      invite_id uuid,
      birth_date date,
      occupation text,
      training_experience text,
      training_frequency text,
      primary_goal text,
      injuries text,
      health_conditions text,
      medications text,
      surgeries text,
      pain text,
      sleep_hours text,
      sleep_quality text,
      stress_level text,
      water_intake text,
      food_restrictions text,
      routine text,
      observations text,
      emergency_contact text,
      submitted_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create function public.get_student_anamnesis(invite_code text)
    returns setof public.student_anamneses
    language sql security definer set search_path = 'public' as $$
      select sa.id, sa.coach_id, sa.student_id, sa.invite_id, sa.birth_date,
        sa.occupation, sa.training_experience, sa.training_frequency,
        sa.primary_goal, sa.injuries, sa.health_conditions, sa.medications,
        sa.surgeries, sa.pain, sa.sleep_hours, sa.sleep_quality,
        sa.stress_level, sa.water_intake, sa.food_restrictions, sa.routine,
        sa.observations, sa.emergency_contact, sa.submitted_at, sa.updated_at
      from public.student_anamneses sa
      join public.student_invites si on si.student_id = sa.student_id
      where si.code = invite_code
      limit 1
    $$;
    alter table public.student_anamneses
      add column answers jsonb not null default '{}'::jsonb,
      add column biological_sex text,
      add column height_cm numeric,
      add column weight_kg numeric,
      add column activity_level text,
      add column source text not null default 'student',
      add column authored_by uuid,
      add column student_update_requested_at timestamptz;
    insert into public.students values ('11111111-1111-4111-8111-111111111111');
    insert into public.student_invites values (
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'invite-login', 'active', now() + interval '1 day', now()
    );
    insert into public.student_anamneses(id, coach_id, student_id, answers)
    values (
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111',
      '{"goal":"Saúde"}'::jsonb
    );
  `)

  await assert.rejects(
    db.query("select * from public.get_student_anamnesis('invite-login')"),
    /return type mismatch|returned type|structure of query/i,
  )

  const migration = await readFile(migrationUrl, 'utf8')
  const mirrorMigration = await readFile(mirrorMigrationUrl, 'utf8')
  assert.equal(mirrorMigration, migration)
  assert.match(migration, /select\s+anamneses\.\*/i)
  assert.match(migration, /set search_path\s*=\s*''/i)
  await db.exec(migration)

  const rows = (await db.query("select * from public.get_student_anamnesis('invite-login')")).rows
  assert.equal(rows.length, 1)
  assert.equal(rows[0].answers.goal, 'Saúde')
  await db.close()
})
