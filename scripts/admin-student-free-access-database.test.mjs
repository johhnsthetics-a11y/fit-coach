const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const master = '11111111-1111-4111-8111-111111111111'
const coach = '22222222-2222-4222-8222-222222222222'
const studentUser = '33333333-3333-4333-8333-333333333333'
const student = '44444444-4444-4444-8444-444444444444'
const otherStudent = '55555555-5555-4555-8555-555555555555'
const regularUser = '66666666-6666-4666-8666-666666666666'

async function setAuth(db, id, email) {
  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '${id}', false);
    select set_config('request.jwt.claims', '{"email":"${email}"}', false);
    set role authenticated;
  `)
}

test('Admin Master grant is normalized, auditable, revocable, and opens the complete student portal', async () => {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;

    create table public.users(
      id uuid primary key references auth.users(id),
      name text,
      email text,
      role text
    );
    create table public.students(
      id uuid primary key,
      coach_id uuid not null references public.users(id),
      auth_user_id uuid,
      name text,
      email text,
      payment text default 'Pendente',
      next_due_date date,
      app_payment_status text default 'pending',
      app_subscription_expires_at timestamptz,
      access_override_until timestamptz
    );
    create table public.student_invites(
      id uuid primary key default gen_random_uuid(),
      coach_id uuid not null references public.users(id),
      student_id uuid not null references public.students(id),
      code text not null unique,
      status text not null default 'active',
      expires_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table public.student_checkout_sessions(
      id uuid primary key default gen_random_uuid(),
      checkout_token uuid not null default gen_random_uuid(),
      coach_id uuid not null,
      student_id uuid not null,
      status text not null default 'pending',
      expires_at timestamptz not null default (now() + interval '30 minutes'),
      updated_at timestamptz not null default now()
    );
    create function public.coachfit_professional_requires_app_payment(p_coach_id uuid)
    returns boolean language sql stable as $$ select true $$;
    create function public.get_student_portal_unchecked(invite_code text)
    returns jsonb language sql stable as $$
      select jsonb_build_object(
        'invite', jsonb_build_object('code', invites.code),
        'student', jsonb_build_object('id', students.id, 'email', students.email),
        'invoices', jsonb_build_array(jsonb_build_object('status', 'Pendente'))
      )
      from public.student_invites as invites
      join public.students as students on students.id = invites.student_id
      where invites.code = trim(invite_code)
      limit 1
    $$;

    insert into auth.users(id) values ('${master}'), ('${coach}'), ('${studentUser}'), ('${regularUser}');
    insert into public.users(id, name, email, role) values
      ('${master}', 'Admin Master', 'sac@coachfitpro.com.br', 'Admin'),
      ('${coach}', 'Treinador QA', 'coach@example.test', 'Treinador'),
      ('${regularUser}', 'Profissional comum', 'professional@example.test', 'Treinador');
    insert into public.students(id, coach_id, auth_user_id, name, email) values
      ('${student}', '${coach}', '${studentUser}', 'Aluno QA', 'student@example.test'),
      ('${otherStudent}', '${coach}', null, 'Outro aluno', 'other@example.test');
    insert into public.student_invites(coach_id, student_id, code) values
      ('${coach}', '${student}', 'invite-student'),
      ('${coach}', '${otherStudent}', 'invite-other');
  `)

  const migrations = await readdir(new URL('../supabase/migrations/', import.meta.url))
  const migration = migrations.find(name => /_admin_student_free_access\.sql$/.test(name))
  assert.ok(migration, 'admin student free-access migration must exist')
  const migrationSql = await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8')
  await db.exec(migrationSql)
  await db.exec(migrationSql)

  assert.equal((await db.query(
    "select public.coachfit_student_financial_access_by_invite('invite-student') as value",
  )).rows[0].value, false)

  await setAuth(db, master, 'sac@coachfitpro.com.br')
  const granted = (await db.query(
    "select public.coachfit_grant_student_free_access(' Student@Example.Test ', 'student', 'Validação integral do aplicativo') as value",
  )).rows[0].value
  assert.equal(granted.email, 'student@example.test')
  assert.equal(granted.beneficiaryType, 'student')
  assert.equal(granted.active, true)

  const grants = (await db.query('select * from public.coachfit_list_student_free_access_grants()')).rows
  assert.equal(grants.length, 1)
  assert.equal(grants[0].email, 'student@example.test')
  assert.equal(grants[0].created_by_email, 'sac@coachfitpro.com.br')

  await db.exec('reset role')
  assert.equal((await db.query(
    "select public.coachfit_student_financial_access_by_invite('invite-student') as value",
  )).rows[0].value, true)
  assert.equal((await db.query(
    "select public.coachfit_student_financial_access_by_invite('invite-other') as value",
  )).rows[0].value, false)
  const portal = (await db.query("select public.get_student_portal('invite-student') as value")).rows[0].value
  assert.equal(portal.financial_access_open, true)
  assert.equal(portal.free_access_granted, true)
  assert.equal(portal.app_payment_required, false)

  await setAuth(db, studentUser, 'student@example.test')
  await assert.rejects(
    db.query("select * from public.create_student_checkout_session_by_invite('invite-student')"),
    /acesso gratuito|liberad/i,
  )
  await assert.rejects(db.query('select * from public.student_free_access_grants'), /permission denied/i)
  await assert.rejects(
    db.query("select public.coachfit_grant_student_free_access('other@example.test', 'patient', '')"),
    /Admin Master|permission|permiss/i,
  )
  await assert.rejects(
    db.query('select * from public.coachfit_list_student_free_access_grants()'),
    /Admin Master|permission|permiss/i,
  )

  await setAuth(db, master, 'sac@coachfitpro.com.br')
  await assert.rejects(
    db.query("select public.coachfit_grant_student_free_access('professional@example.test', 'student', '')"),
    /aluno|paciente/i,
  )
  const revoked = (await db.query(
    "select public.coachfit_revoke_student_free_access('STUDENT@example.test') as value",
  )).rows[0].value
  assert.equal(revoked.active, false)
  assert.ok(revoked.revokedAt)

  await db.exec('reset role')
  assert.equal((await db.query(
    "select public.coachfit_student_financial_access_by_invite('invite-student') as value",
  )).rows[0].value, false)
  assert.equal((await db.query(
    "select count(*)::int as count from public.student_free_access_grants where email = 'student@example.test'",
  )).rows[0].count, 1)

  await db.close()
})

