import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')

const coachA = '11111111-1111-4111-8111-111111111111'
const coachB = '22222222-2222-4222-8222-222222222222'
const studentA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

async function setAuth(db, id) {
  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '${id}', false);
    set role authenticated;
  `)
}

async function createDatabase() {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;

    create table public.users(id uuid primary key);
    create table public.students(
      id uuid primary key,
      coach_id uuid not null references public.users(id),
      name text
    );
    create table public.student_invites(
      id uuid primary key,
      coach_id uuid not null references public.users(id),
      student_id uuid not null references public.students(id),
      code text not null,
      status text not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );
    create table public.notifications(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users(id),
      title text not null,
      body text not null,
      read boolean not null default false
    );
    create table public.student_anamneses(
      id uuid primary key default gen_random_uuid(),
      coach_id uuid not null references public.users(id) on delete cascade,
      student_id uuid not null references public.students(id) on delete cascade,
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
      updated_at timestamptz not null default now(),
      unique (student_id)
    );
    alter table public.student_anamneses enable row level security;
    create policy "coach can read own student anamneses"
      on public.student_anamneses for select to authenticated
      using (coach_id = (select auth.uid()));
    grant select, insert, update on public.student_anamneses to authenticated;

    insert into public.users(id) values ('${coachA}'), ('${coachB}');
    insert into public.students(id, coach_id, name) values ('${studentA}', '${coachA}', 'Pessoa de teste');
    insert into public.student_invites(id, coach_id, student_id, code, status, expires_at)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${coachA}', '${studentA}', 'invite-valid', 'active', now() + interval '1 day');
  `)
  let migration = ''
  try {
    migration = await readFile(
      new URL('../SUPABASE/migrations/20261007183500_professional_student_anamnesis.sql', import.meta.url),
      'utf8',
    )
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await db.exec(migration)
  return db
}

test('profissional salva anamnese somente para aluno vinculado e sem escrita direta', async () => {
  const db = await createDatabase()
  const answers = {
    birthDate: '1995-05-20',
    biologicalSex: 'Feminino',
    heightCm: '168',
    weightKg: '64.5',
    activityLevel: 'Moderado',
    injuries: 'Joelho direito',
    foodRestrictions: 'Lactose',
  }

  await db.exec('set role anon')
  await assert.rejects(
    db.query(
      'select * from public.save_professional_student_anamnesis($1, $2::jsonb)',
      [studentA, JSON.stringify(answers)],
    ),
    /permission denied/i,
  )

  await setAuth(db, coachA)
  const saved = (await db.query(
    'select * from public.save_professional_student_anamnesis($1, $2::jsonb)',
    [studentA, JSON.stringify(answers)],
  )).rows[0]
  assert.equal(saved.student_id, studentA)
  assert.equal(saved.coach_id, coachA)
  assert.equal(saved.source, 'professional')
  assert.equal(saved.authored_by, coachA)
  assert.equal(saved.answers.biologicalSex, 'Feminino')
  assert.equal(Number(saved.height_cm), 168)
  assert.equal(Number(saved.weight_kg), 64.5)

  await assert.rejects(
    db.query('insert into public.student_anamneses (coach_id, student_id) values ($1, $2)', [coachA, studentA]),
    /row-level security/i,
  )
  const directUpdate = await db.query(
    "update public.student_anamneses set primary_goal = 'Alterado direto' where student_id = $1 returning primary_goal",
    [studentA],
  )
  assert.equal(directUpdate.rows.length, 0)

  await setAuth(db, coachB)
  assert.equal((await db.query('select * from public.student_anamneses')).rows.length, 0)
  await assert.rejects(
    db.query(
      'select * from public.save_professional_student_anamnesis($1, $2::jsonb)',
      [studentA, JSON.stringify({ primaryGoal: 'Outro objetivo' })],
    ),
    /aluno.*não encontrado|permission/i,
  )

  await setAuth(db, coachA)
  const updated = (await db.query(
    'select * from public.save_professional_student_anamnesis($1, $2::jsonb)',
    [studentA, JSON.stringify({ primaryGoal: 'Hipertrofia' })],
  )).rows[0]
  assert.equal(updated.answers.primaryGoal, 'Hipertrofia')
  assert.equal((await db.query('select count(*)::int as count from public.student_anamneses')).rows[0].count, 1)
})

test('envio pelo aluno continua ativo e armazena o formulário completo', async () => {
  const db = await createDatabase()
  await db.exec('set role anon')
  const answers = {
    birthDate: '1995-05-20',
    biologicalSex: 'Feminino',
    heightCm: '168',
    weightKg: '64.5',
    activityLevel: 'Moderado',
    primaryGoal: 'Condicionamento',
    foodRestrictions: 'Lactose',
  }
  const result = (await db.query(
    'select * from public.submit_student_anamnesis($1, $2::jsonb)',
    ['invite-valid', JSON.stringify(answers)],
  )).rows[0]

  assert.equal(result.student_id, studentA)
  assert.equal(result.source, 'student')
  assert.equal(result.answers.biologicalSex, 'Feminino')
  assert.equal(Number(result.height_cm), 168)
  assert.equal(Number(result.weight_kg), 64.5)
  await db.exec('reset role')
  assert.equal((await db.query("select count(*)::int as count from public.notifications where title = 'Nova anamnese recebida'")).rows[0].count, 1)
})
