import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const coachA = '11111111-1111-4111-8111-111111111111'
const coachB = '22222222-2222-4222-8222-222222222222'
const studentA = '33333333-3333-4333-8333-333333333333'
const studentB = '44444444-4444-4444-8444-444444444444'

async function setRole(db, role, userId = '') {
  await db.exec('reset role')
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role ${role}`)
}

async function createDatabase() {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;

    create table public.users(id uuid primary key);
    create table public.students(
      id uuid primary key,
      coach_id uuid not null references auth.users(id),
      name text not null
    );
    create table public.student_invites(
      id uuid primary key default gen_random_uuid(),
      coach_id uuid not null references auth.users(id),
      student_id uuid not null references public.students(id),
      code text not null,
      status text not null,
      expires_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table public.notifications(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id),
      title text not null,
      body text not null,
      read boolean not null default false,
      created_at timestamptz not null default now()
    );
    create table public.student_anamneses(
      id uuid primary key default gen_random_uuid(),
      coach_id uuid not null references auth.users(id),
      student_id uuid not null references public.students(id),
      invite_id uuid,
      answers jsonb not null default '{}'::jsonb,
      source text not null default 'student',
      authored_by uuid,
      submitted_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      student_update_requested_at timestamptz,
      unique(student_id)
    );
    create table public.nutrition_questionnaires (
      id text primary key,
      coach_id uuid not null references auth.users(id),
      title text not null,
      description text not null default '',
      questions jsonb not null,
      status text not null default 'Rascunho',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table public.nutrition_questionnaire_assignments (
      id uuid primary key default gen_random_uuid(),
      coach_id uuid not null references auth.users(id),
      student_id uuid not null references public.students(id),
      questionnaire_id text not null references public.nutrition_questionnaires(id),
      question_snapshot jsonb not null,
      answers jsonb not null default '{}'::jsonb,
      status text not null default 'Pendente' check (status in ('Pendente', 'Respondido')),
      sent_at timestamptz not null default now(),
      completed_at timestamptz,
      updated_at timestamptz not null default now()
    );
    create unique index nutrition_questionnaire_pending_unique
      on public.nutrition_questionnaire_assignments(student_id, questionnaire_id)
      where status = 'Pendente';

    alter table public.nutrition_questionnaires enable row level security;
    alter table public.nutrition_questionnaire_assignments enable row level security;
    create policy questionnaire_owner on public.nutrition_questionnaires to authenticated
      using (coach_id = auth.uid()) with check (coach_id = auth.uid());
    create policy questionnaire_assignment_owner on public.nutrition_questionnaire_assignments
      for select to authenticated using (coach_id = auth.uid());
    grant select, insert, update, delete on public.nutrition_questionnaires to authenticated;
    grant select on public.nutrition_questionnaire_assignments to authenticated;

    create function public.student_nutrition_questionnaires_unchecked(invite_code text)
    returns jsonb language sql security definer set search_path = '' as
      $$ select '[]'::jsonb $$;
    create function public.submit_nutrition_questionnaire_unchecked(invite_code text, selected_assignment_id uuid, answers_value jsonb)
    returns jsonb language sql security definer set search_path = '' as
      $$ select '{}'::jsonb $$;
    create function public.student_nutrition_questionnaires(invite_code text)
    returns jsonb language sql security definer set search_path = '' as
      $$ select public.student_nutrition_questionnaires_unchecked(invite_code) $$;
    create function public.submit_nutrition_questionnaire(invite_code text, selected_assignment_id uuid, answers_value jsonb)
    returns jsonb language sql security definer set search_path = '' as
      $$ select public.submit_nutrition_questionnaire_unchecked(invite_code, selected_assignment_id, answers_value) $$;
    revoke all on function public.student_nutrition_questionnaires_unchecked(text) from public, anon, authenticated;
    revoke all on function public.submit_nutrition_questionnaire_unchecked(text, uuid, jsonb) from public, anon, authenticated;
    revoke all on function public.student_nutrition_questionnaires(text) from public;
    revoke all on function public.submit_nutrition_questionnaire(text, uuid, jsonb) from public;
    grant execute on function public.student_nutrition_questionnaires(text) to anon, authenticated;
    grant execute on function public.submit_nutrition_questionnaire(text, uuid, jsonb) to anon, authenticated;

    insert into auth.users values ('${coachA}'), ('${coachB}');
    insert into public.users values ('${coachA}'), ('${coachB}');
    insert into public.students values
      ('${studentA}', '${coachA}', 'Aluno A'),
      ('${studentB}', '${coachB}', 'Aluno B');
    insert into public.student_invites(coach_id, student_id, code, status, expires_at)
      values ('${coachA}', '${studentA}', 'invite-a', 'active', now() + interval '1 day');
    insert into public.nutrition_questionnaires(id, coach_id, title, questions)
      values ('legacy', '${coachA}', 'Questionário legado', '[{"id":"legacy-q","label":"Legado","type":"text","required":false}]');
  `)

  const migration = await readFile(
    new URL('../supabase/migrations/20261009173940_student_anamnesis_builder.sql', import.meta.url),
    'utf8',
  )
  await db.exec(migration)
  return { db, migration }
}

const requiredQuestion = JSON.stringify([
  { id: 'goal', label: 'Qual é o seu objetivo?', type: 'text', required: true },
])

test('migration defaults existing models to nutrition and constrains questionnaire types', async () => {
  const { db, migration } = await createDatabase()
  assert.equal((await db.query("select questionnaire_type from public.nutrition_questionnaires where id = 'legacy'")).rows[0].questionnaire_type, 'nutrition')
  await assert.rejects(
    db.query("insert into public.nutrition_questionnaires(id, coach_id, title, questions, questionnaire_type) values ('bad', $1, 'Inválido', '[]', 'medical')", [coachA]),
    /check constraint|violates/i,
  )
  await db.exec(migration)
  await db.close()
})

test('assignment validates ownership, hides future work and updates a pending resend', async () => {
  const { db } = await createDatabase()
  await setRole(db, 'authenticated', coachA)
  await db.query(
    "insert into public.nutrition_questionnaires(id, coach_id, title, questions, questionnaire_type) values ('anam-a', $1, 'Anamnese A', $2::jsonb, 'anamnesis')",
    [coachA, requiredQuestion],
  )
  await db.query(
    "insert into public.nutrition_questionnaires(id, coach_id, title, questions, questionnaire_type) values ('anam-b', $1, 'Anamnese B', $2::jsonb, 'anamnesis')",
    [coachB, requiredQuestion],
  ).catch(() => {})

  const future = new Date(Date.now() + 3_600_000).toISOString()
  const assigned = (await db.query(
    'select public.assign_student_anamnesis($1, $2, $3, $4) as value',
    ['anam-a', studentA, future, true],
  )).rows[0].value
  assert.equal(assigned.priority_required, true)
  assert.equal((await db.query("select jsonb_array_length(public.student_nutrition_questionnaires('invite-a')) as count")).rows[0].count, 0)

  await db.query("update public.nutrition_questionnaires set title = 'Anamnese atualizada' where id = 'anam-a'")
  const resent = (await db.query(
    "select public.assign_student_anamnesis($1, $2, now() - interval '1 minute', false) as value",
    ['anam-a', studentA],
  )).rows[0].value
  assert.equal(resent.id, assigned.id)
  assert.equal(resent.priority_required, false)
  assert.equal(resent.question_snapshot.title, 'Anamnese atualizada')
  assert.equal((await db.query("select jsonb_array_length(public.student_nutrition_questionnaires('invite-a')) as count")).rows[0].count, 1)

  await assert.rejects(
    db.query("select public.assign_student_anamnesis('anam-a', $1, now(), true)", [studentB]),
    /não pertence|nao pertence|permission/i,
  )
  await setRole(db, 'authenticated', coachB)
  await assert.rejects(
    db.query("select public.assign_student_anamnesis('anam-a', $1, now(), true)", [studentB]),
    /não pertence|nao pertence|permission/i,
  )
  await db.close()
})

test('required answers preserve pending state and valid answers update canonical history atomically', async () => {
  const { db } = await createDatabase()
  await setRole(db, 'authenticated', coachA)
  await db.query(
    "insert into public.nutrition_questionnaires(id, coach_id, title, questions, questionnaire_type) values ('anam-a', $1, 'Anamnese A', $2::jsonb, 'anamnesis')",
    [coachA, requiredQuestion],
  )
  const assignmentId = (await db.query(
    "select (public.assign_student_anamnesis('anam-a', $1, now(), true)->>'id')::uuid as id",
    [studentA],
  )).rows[0].id

  await setRole(db, 'anon')
  await assert.rejects(
    db.query("select public.submit_nutrition_questionnaire('invite-a', $1, '{}'::jsonb)", [assignmentId]),
    /obrigat|responda/i,
  )
  await db.exec('reset role')
  assert.equal((await db.query("select status from public.nutrition_questionnaire_assignments where id = $1", [assignmentId])).rows[0].status, 'Pendente')
  assert.equal((await db.query('select count(*)::int as count from public.student_anamneses')).rows[0].count, 0)
  assert.equal((await db.query('select count(*)::int as count from public.notifications')).rows[0].count, 0)

  await setRole(db, 'anon')
  const completed = (await db.query(
    "select public.submit_nutrition_questionnaire('invite-a', $1, $2::jsonb) as value",
    [assignmentId, JSON.stringify({ goal: 'Hipertrofia' })],
  )).rows[0].value
  assert.equal(completed.status, 'Respondido')
  await db.exec('reset role')
  const canonical = (await db.query('select answers, source from public.student_anamneses where student_id = $1', [studentA])).rows[0]
  assert.equal(canonical.answers.goal, 'Hipertrofia')
  assert.equal(canonical.source, 'student')
  assert.equal((await db.query('select count(*)::int as count from public.notifications')).rows[0].count, 1)

  await setRole(db, 'anon')
  await db.query("select public.submit_nutrition_questionnaire('invite-a', $1, $2::jsonb)", [assignmentId, JSON.stringify({ goal: 'Duplicada' })])
  await db.exec('reset role')
  assert.equal((await db.query('select count(*)::int as count from public.notifications')).rows[0].count, 1)
  assert.equal((await db.query('select answers from public.student_anamneses where student_id = $1', [studentA])).rows[0].answers.goal, 'Hipertrofia')
  await db.close()
})

test('a later completed anamnesis replaces only the canonical version and keeps assignment history', async () => {
  const { db } = await createDatabase()
  await setRole(db, 'authenticated', coachA)
  for (const id of ['anam-one', 'anam-two']) {
    await db.query(
      'insert into public.nutrition_questionnaires(id, coach_id, title, questions, questionnaire_type) values ($1, $2, $1, $3::jsonb, $4)',
      [id, coachA, requiredQuestion, 'anamnesis'],
    )
    const assignmentId = (await db.query(
      'select (public.assign_student_anamnesis($1, $2, now(), true)->>\'id\')::uuid as id',
      [id, studentA],
    )).rows[0].id
    await setRole(db, 'anon')
    await db.query(
      "select public.submit_nutrition_questionnaire('invite-a', $1, $2::jsonb)",
      [assignmentId, JSON.stringify({ goal: id })],
    )
    await setRole(db, 'authenticated', coachA)
  }
  await db.exec('reset role')
  assert.equal((await db.query("select count(*)::int as count from public.nutrition_questionnaire_assignments where status = 'Respondido'")).rows[0].count, 2)
  assert.equal((await db.query('select count(*)::int as count from public.student_anamneses')).rows[0].count, 1)
  assert.equal((await db.query('select answers from public.student_anamneses where student_id = $1', [studentA])).rows[0].answers.goal, 'anam-two')
  await db.close()
})

test('anonymous users cannot read questionnaire tables directly', async () => {
  const { db } = await createDatabase()
  await setRole(db, 'anon')
  await assert.rejects(db.query('select * from public.nutrition_questionnaires'), /permission denied/i)
  await assert.rejects(db.query('select * from public.nutrition_questionnaire_assignments'), /permission denied/i)
  await db.close()
})
