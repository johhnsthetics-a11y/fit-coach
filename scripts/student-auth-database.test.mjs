const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const db = new PGlite()
const coachA = '11111111-1111-4111-8111-111111111111'
const coachB = '22222222-2222-4222-8222-222222222222'
const studentA = '33333333-3333-4333-8333-333333333333'
const studentB = '44444444-4444-4444-8444-444444444444'
const authA = '55555555-5555-4555-8555-555555555555'
const authB = '66666666-6666-4666-8666-666666666666'

await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  create table public.users(
    id uuid primary key references auth.users(id),
    name text,
    email text,
    role text
  );
  create table public.students(
    id uuid primary key,
    coach_id uuid not null references public.users(id),
    name text not null,
    email text
  );
  create table public.student_invites(
    id uuid primary key default gen_random_uuid(),
    coach_id uuid not null,
    student_id uuid not null,
    code text not null,
    status text not null,
    expires_at timestamptz,
    created_at timestamptz not null default now()
  );

  insert into auth.users(id) values
    ('${coachA}'), ('${coachB}'), ('${authA}'), ('${authB}');
  insert into public.users(id, name, email, role) values
    ('${coachA}', 'Treinador A', 'a@coach.test', 'Coach principal'),
    ('${coachB}', 'Nutricionista B', 'b@coach.test', 'Nutricionista');
  insert into public.students(id, coach_id, name, email) values
    ('${studentA}', '${coachA}', 'Aluno A', 'aluno@example.test'),
    ('${studentB}', '${coachB}', 'Paciente B', 'paciente@example.test');
  insert into public.student_invites(coach_id, student_id, code, status, expires_at) values
    ('${coachA}', '${studentA}', 'invite-student-a', 'active', now() + interval '1 year'),
    ('${coachB}', '${studentB}', 'invite-patient-b', 'active', now() + interval '1 year');
`)

const migration = await readFile(
  new URL('../supabase/migrations/20260930175644_student_auth_credentials.sql', import.meta.url),
  'utf8',
)
await db.exec(migration)

await db.exec(`
  update public.students set auth_user_id = '${authA}', must_change_password = true where id = '${studentA}';
  update public.students set auth_user_id = '${authB}', must_change_password = false where id = '${studentB}';
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${authA}', false);
`)

const ownAccess = (await db.query('select * from public.get_current_student_access()')).rows
assert.equal(ownAccess.length, 1)
assert.equal(ownAccess[0].student_id, studentA)
assert.equal(ownAccess[0].invite_code, 'invite-student-a')
assert.equal(ownAccess[0].must_change_password, true)
assert.equal(ownAccess[0].email, 'aluno@example.test')
assert.equal(ownAccess[0].professional_type, 'trainer')

await db.exec(`select set_config('request.jwt.claim.sub', '${authB}', false);`)
const patientAccess = (await db.query('select * from public.get_current_student_access()')).rows
assert.equal(patientAccess.length, 1)
assert.equal(patientAccess[0].student_id, studentB)
assert.equal(patientAccess[0].invite_code, 'invite-patient-b')
assert.equal(patientAccess[0].professional_type, 'nutritionist')

await db.exec(`reset role; set role anon; select set_config('request.jwt.claim.sub', '', false);`)
await assert.rejects(
  db.query('select * from public.get_current_student_access()'),
  /permission denied/i,
)

await db.exec('reset role')
await assert.rejects(
  db.exec(`update public.students set auth_user_id = '${authA}' where id = '${studentB}'`),
  /unique|duplicate/i,
)

console.log('Student Auth: current-user bootstrap, role routing, anon denial and unique identity PASS')
await db.close()
