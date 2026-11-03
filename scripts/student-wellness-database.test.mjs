import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migrationSql = await readFile(new URL('../supabase/migrations/20261103131000_student_workout_rating_meal_photos.sql', import.meta.url), 'utf8')

async function createDatabase() {
  const db = new PGlite()
  await db.exec([
    'create role anon;',
    'create role authenticated;',
    'create schema auth;',
    'create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;',
    "create function auth.role() returns text language sql stable as $$ select 'anon'::text $$;",
    'create schema storage;',
    'create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);',
    'create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner_id uuid);',
    'alter table storage.objects enable row level security;',
    'create table public.students (id uuid primary key, coach_id uuid, auth_user_id uuid, avatar_path text);',
    'create table public.workout_logs (id uuid primary key, coach_id uuid, student_id uuid, notes text);',
    'create table public.nutrition_plans (id uuid primary key, student_id uuid, coach_id uuid, active boolean);',
    'create table public.student_invites (code text, status text, expires_at timestamptz, created_at timestamptz, coach_id uuid, student_id uuid);',
    'create function public.coachfit_student_financial_access_by_invite(text) returns boolean language sql stable as $$ select true $$;',
    'create table public.coach_settings (coach_id uuid, profile_avatar_path text);',
    'create table public.checkins (id uuid, student_id uuid);',
    'create table public.checkin_photos (checkin_id uuid, storage_url text);',
    'create table public.messages (coach_id uuid, student_id uuid, attachment_url text);',
    'create table public.workouts (id uuid, coach_id uuid);',
    'create table public.workout_exercises (workout_id uuid, video_url text);',
  ].join('\n'))
  await db.exec(migrationSql)
  await db.exec([
    "insert into public.students (id,coach_id,auth_user_id) values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');",
    "insert into public.student_invites (code,status,created_at,coach_id,student_id) values ('invite-one','active',now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),('invite-two','active',now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');",
    "insert into public.nutrition_plans (id,student_id,coach_id,active) values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);",
    "insert into public.workout_logs (id,coach_id,student_id,notes) values ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','[coachfitpro-completion:full-session]'),('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','[coachfitpro-completion:early-session][coachfitpro-ended-early:early-session]');",
  ].join('\n'))
  return db
}

test('rating aceita treino concluído e rejeita encerramento parcial e aluno diferente', async () => {
  const db = await createDatabase()
  try {
    const ok = await db.query('select public.rate_student_workout_log($1,$2::uuid,$3::smallint) as log', ['invite-one','44444444-4444-4444-8444-444444444444',5])
    assert.equal(ok.rows[0].log.rating, 5)
    assert.ok(ok.rows[0].log.rated_at)
    await assert.rejects(
      db.query('select public.rate_student_workout_log($1,$2::uuid,$3::smallint)', ['invite-one','55555555-5555-4555-8555-555555555555',4]),
      /Treino concluído não encontrado/,
    )
    await assert.rejects(
      db.query('select public.rate_student_workout_log($1,$2::uuid,$3::smallint)', ['invite-two','44444444-4444-4444-8444-444444444444',3]),
      /Treino concluído não encontrado/,
    )
    await assert.rejects(
      db.query('select public.rate_student_workout_log($1,$2::uuid,$3::smallint)', ['invite-one','44444444-4444-4444-8444-444444444444',6]),
      /uma e cinco estrelas/,
    )
  } finally { await db.close() }
})

test('refeição exige plano da mesma conta e foto removida antes de apagar registro', async () => {
  const db = await createDatabase()
  try {
    const saved = await db.query('select public.create_student_meal_log($1,$2::uuid,$3,$4,$5,$6,$7) as meal', [
      'invite-one','33333333-3333-4333-8333-333333333333','Almoço','Após treino','image/jpeg',4096,'jpg',
    ])
    const row = saved.rows[0].meal
    assert.equal(row.meal_name, 'Almoço')
    assert.match(row.photo_path, /^aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/11111111-1111-4111-8111-111111111111\/[0-9a-f-]+\.jpg$/)
    const list = await db.query('select public.get_student_meal_logs($1) as meals',['invite-one'])
    assert.equal(list.rows[0].meals.length,1)
    await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['meal-photos',row.photo_path])
    await assert.rejects(
      db.query('select public.delete_student_meal_log($1,$2::uuid)',['invite-one',row.id]),/Remova a foto privada/,
    )
    await db.query('delete from storage.objects where bucket_id=$1 and name=$2',['meal-photos',row.photo_path])
    const done=await db.query('select public.delete_student_meal_log($1,$2::uuid) as deleted',['invite-one',row.id])
    assert.equal(done.rows[0].deleted,true)
    await assert.rejects(
      db.query('select public.create_student_meal_log($1,$2::uuid,$3,$4,$5,$6,$7)',[
        'invite-one','99999999-9999-4999-8999-999999999999','Jantar','','image/jpeg',10,'jpg',
      ]),/não pertence a esta conta/,
    )
  } finally { await db.close() }
})
