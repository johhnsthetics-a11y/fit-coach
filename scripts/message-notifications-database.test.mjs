const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

test('student messages create one durable navigable notification for the professional', async () => {
  const migrationFiles = await readdir(new URL('../supabase/migrations/', import.meta.url))
  const migrationFile = migrationFiles.find((file) => /_notify_professional_on_student_message\.sql$/.test(file))
  assert.ok(migrationFile, 'message notification migration must exist')

  const db = new PGlite()
  const coach = '11111111-1111-4111-8111-111111111111'
  const student = '22222222-2222-4222-8222-222222222222'
  const studentMessage = '33333333-3333-4333-8333-333333333333'
  const coachMessage = '44444444-4444-4444-8444-444444444444'

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create table public.users(id uuid primary key, role text);
      create table public.students(id uuid primary key, coach_id uuid not null references public.users(id), name text not null);
      create table public.messages(
        id uuid primary key,
        coach_id uuid not null references public.users(id),
        student_id uuid not null references public.students(id),
        sender text not null,
        body text,
        created_at timestamptz default now()
      );
      create table public.notifications(
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references public.users(id),
        title text not null,
        body text,
        read boolean default false,
        created_at timestamptz default now()
      );
      insert into public.users(id, role) values ('${coach}', 'Nutricionista');
      insert into public.students(id, coach_id, name) values ('${student}', '${coach}', 'Marina Costa');
    `)
    await db.exec(await readFile(new URL(`../supabase/migrations/${migrationFile}`, import.meta.url), 'utf8'))
    await db.exec(`
      insert into public.messages(id, coach_id, student_id, sender, body)
      values ('${studentMessage}', '${coach}', '${student}', 'student', 'Preciso ajustar o plano alimentar.');
      insert into public.messages(id, coach_id, student_id, sender, body)
      values ('${coachMessage}', '${coach}', '${student}', 'coach', 'Vamos revisar.');
    `)

    assert.deepEqual(
      (await db.query('select user_id, title, body, read, event_type, entity_id, student_id from public.notifications order by created_at')).rows,
      [{
        user_id: coach,
        title: 'Nova mensagem recebida',
        body: 'Marina Costa: Preciso ajustar o plano alimentar.',
        read: false,
        event_type: 'student_message',
        entity_id: studentMessage,
        student_id: student,
      }],
    )

    await db.query('select public.notify_professional_on_student_message(messages) from public.messages where id = $1', [studentMessage])
    assert.equal((await db.query('select count(*)::int as total from public.notifications')).rows[0].total, 1)
  } finally {
    await db.close()
  }
})
