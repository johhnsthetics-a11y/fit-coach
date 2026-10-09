import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
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

test('coach protocol tasks enforce owner and student RLS, CRUD grants, and preserve tasks when students are deleted', async () => {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table public.users (id uuid primary key);
    create table public.students (
      id uuid primary key,
      coach_id uuid not null references public.users(id)
    );
    grant select on public.students to authenticated;
    insert into public.users values ('${coachA}'), ('${coachB}');
    insert into public.students values ('${studentA}', '${coachA}'), ('${studentB}', '${coachB}');
  `)

  const migrations = await readdir(new URL('../supabase/migrations/', import.meta.url))
  const migration = migrations.find(name => /_coach_protocol_tasks\.sql$/.test(name))
  assert.ok(migration, 'coach protocol task migration must exist')
  const migrationSql = await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8')
  await db.exec(migrationSql)
  await db.exec(migrationSql)

  await setRole(db, 'authenticated', coachA)
  const inserted = (await db.query(`
    insert into public.coach_protocol_tasks (coach_id, student_id, title, category, planned_date)
    values ($1, $2, 'Revisar treino', 'training', current_date)
    returning id
  `, [coachA, studentA])).rows[0]
  assert.ok(inserted.id)
  assert.equal((await db.query('select count(*)::int as count from public.coach_protocol_tasks')).rows[0].count, 1)
  await db.query("update public.coach_protocol_tasks set title = 'Treino atualizado' where id = $1", [inserted.id])
  assert.equal((await db.query('select title from public.coach_protocol_tasks where id = $1', [inserted.id])).rows[0].title, 'Treino atualizado')

  await assert.rejects(db.query(`
    insert into public.coach_protocol_tasks (coach_id, student_id, title, category, planned_date)
    values ($1, $2, 'Aluno de outro profissional', 'training', current_date)
  `, [coachA, studentB]), /row-level security|policy|violates/i)
  await assert.rejects(db.query('update public.coach_protocol_tasks set student_id = $1 where id = $2', [studentB, inserted.id]), /row-level security|policy|violates/i)
  await assert.rejects(db.query(`
    insert into public.coach_protocol_tasks (coach_id, title, category, planned_date)
    values ($1, '   ', 'training', current_date)
  `, [coachA]), /check constraint|violates/i)
  await assert.rejects(db.query(`
    insert into public.coach_protocol_tasks (coach_id, title, category, planned_date)
    values ($1, 'Categoria inválida', 'other', current_date)
  `, [coachA]), /check constraint|violates/i)
  await assert.rejects(db.query(`
    insert into public.coach_protocol_tasks (coach_id, title, category, planned_date)
    values ($1, 'Tarefa alheia', 'general', current_date)
  `, [coachB]), /row-level security|policy|violates/i)

  await setRole(db, 'authenticated', coachB)
  assert.equal((await db.query('select count(*)::int as count from public.coach_protocol_tasks')).rows[0].count, 0)
  assert.equal((await db.query('delete from public.coach_protocol_tasks where id = $1 returning id', [inserted.id])).rows.length, 0)

  await setRole(db, 'anon')
  await assert.rejects(db.query('select * from public.coach_protocol_tasks'), /permission denied/i)

  await db.exec('reset role')
  await db.query('delete from public.students where id = $1', [studentA])
  const preserved = (await db.query('select student_id from public.coach_protocol_tasks where id = $1', [inserted.id])).rows[0]
  assert.equal(preserved.student_id, null)
  await setRole(db, 'authenticated', coachA)
  await db.query('delete from public.coach_protocol_tasks where id = $1', [inserted.id])
  assert.equal((await db.query('select count(*)::int as count from public.coach_protocol_tasks')).rows[0].count, 0)
  await db.close()
})
