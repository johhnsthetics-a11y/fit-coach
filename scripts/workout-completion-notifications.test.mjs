import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transformWithEsbuild } from 'vite'

const migrationUrl = new URL('../supabase/migrations/20261105160000_student_workout_finish_notifications.sql', import.meta.url)
const migration = await readFile(migrationUrl, 'utf8')
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const chatModel = await readFile(new URL('../src/chat/chatModel.js', import.meta.url), 'utf8')
const studentsCss = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const edgeFunction = await readFile(new URL('../supabase/functions/workout-completion-push/index.ts', import.meta.url), 'utf8')
const supabaseConfig = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8')

test('treino encerrado cria notificação durável só quando a preferência do aluno está ativa', async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
  const db = new PGlite()
  const coachA = '11111111-1111-4111-8111-111111111111'
  const studentA = '22222222-2222-4222-8222-222222222222'
  const coachB = '33333333-3333-4333-8333-333333333333'
  const studentB = '44444444-4444-4444-8444-444444444444'
  const workoutA = '55555555-5555-4555-8555-555555555555'
  const workoutB = '66666666-6666-4666-8666-666666666666'
  const workoutMessageA = '77777777-7777-4777-8777-777777777777'
  const workoutMessageB = '88888888-8888-4888-8888-888888888888'
  const normalMessageB = '99999999-9999-4999-8999-999999999999'

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create table public.users(id uuid primary key, role text);
      create table public.students(
        id uuid primary key,
        coach_id uuid not null references public.users(id),
        name text not null
      );
      create table public.student_invites(
        id uuid primary key default gen_random_uuid(),
        code text not null,
        coach_id uuid not null references public.users(id),
        student_id uuid not null references public.students(id),
        status text not null,
        expires_at timestamptz not null
      );
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
      create table public.workout_logs(
        id uuid primary key,
        coach_id uuid not null references public.users(id),
        student_id uuid not null references public.students(id),
        title text,
        notes text,
        created_at timestamptz default now()
      );
      insert into public.users(id, role) values
        ('${coachA}', 'trainer'), ('${coachB}', 'trainer');
      insert into public.students(id, coach_id, name) values
        ('${studentA}', '${coachA}', 'Ana Silva'), ('${studentB}', '${coachB}', 'Bruno Lima');
      insert into public.student_invites(code, coach_id, student_id, status, expires_at) values
        ('INVITE-A-123456', '${coachA}', '${studentA}', 'active', now() + interval '1 day'),
        ('INVITE-B-123456', '${coachB}', '${studentB}', 'active', now() + interval '1 day');
      create or replace function public.submit_student_message(
        invite_code text,
        message_body text,
        attachment_url text default null,
        attachment_type text default null,
        attachment_name text default null,
        client_message_id uuid default null
      ) returns public.messages
      language plpgsql security definer set search_path = '' as $$
      declare invite public.student_invites%rowtype; saved public.messages%rowtype;
      begin
        select * into invite from public.student_invites where code = invite_code and status = 'active' and expires_at > now();
        if invite.id is null then raise exception 'invalid invite'; end if;
        insert into public.messages(id, coach_id, student_id, sender, body)
        values (coalesce(client_message_id, gen_random_uuid()), invite.coach_id, invite.student_id, 'student', message_body)
        returning * into saved;
        return saved;
      end;
      $$;
    `)
    await db.exec(migration)
    await db.query('update public.students set notify_coach_on_workout_finish = false where id = $1', [studentB])

    await db.exec(`
      insert into public.workout_logs(id, coach_id, student_id, title, notes) values
        ('${workoutA}', '${coachA}', '${studentA}', 'Força A', '[coachfitpro-completion:token-a]'),
        ('${workoutB}', '${coachB}', '${studentB}', 'Mobilidade', '[coachfitpro-ended-early:token-b]');
    `)
    await db.query('select public.submit_student_workout_completion_message($1, $2, $3)', ['INVITE-A-123456', 'Ana concluiu Força A.', workoutMessageA])
    await db.query('select public.submit_student_workout_completion_message($1, $2, $3)', ['INVITE-B-123456', 'Bruno encerrou Mobilidade.', workoutMessageB])
    await db.query('select public.submit_student_message($1, $2, null, null, null, $3)', ['INVITE-B-123456', 'Tenho uma dúvida sobre o treino.', normalMessageB])

    const notificationRows = (await db.query(`
      select user_id, title, body, event_type, entity_id, student_id
      from public.notifications
      order by event_type, entity_id
    `)).rows
    assert.deepEqual(notificationRows, [
      {
        user_id: coachB,
        title: 'Nova mensagem recebida',
        body: 'Bruno Lima: Tenho uma dúvida sobre o treino.',
        event_type: 'student_message',
        entity_id: normalMessageB,
        student_id: studentB,
      },
      {
        user_id: coachA,
        title: 'Treino encerrado',
        body: 'Ana Silva encerrou Força A.',
        event_type: 'student_workout_finished',
        entity_id: workoutA,
        student_id: studentA,
      },
    ])

    const messageRows = (await db.query('select id, message_kind from public.messages order by id')).rows
    assert.deepEqual(messageRows, [
      { id: workoutMessageA, message_kind: 'workout_completion' },
      { id: workoutMessageB, message_kind: 'workout_completion' },
      { id: normalMessageB, message_kind: 'chat' },
    ])

    const firstClaim = await db.query('select public.claim_workout_completion_push_delivery($1, $2) as claimed', [workoutA, coachA])
    const duplicateClaim = await db.query('select public.claim_workout_completion_push_delivery($1, $2) as claimed', [workoutA, coachA])
    assert.equal(firstClaim.rows[0].claimed, true)
    assert.equal(duplicateClaim.rows[0].claimed, false)
  } finally {
    await db.close()
  }
})

test('a notificação não altera mensagens comuns e o evento é roteado pelo tipo persistido', () => {
  assert.match(migration, /notify_coach_on_workout_finish boolean not null default true/i)
  assert.match(migration, /message_kind text not null default 'chat'/i)
  assert.match(migration, /submit_student_workout_completion_message/)
  assert.match(migration, /current_setting\('coachfit\.workout_completion_event', true\)/)
  assert.match(migration, /student_workout_finished/)
  assert.match(migration, /workout_logs_notify_professional_after_student_finish/)
  assert.match(migration, /on conflict \(event_type, entity_id\)[\s\S]*?do nothing/i)
  assert.match(chatModel, /message\?\.messageKind !== 'workout_completion'/)
  assert.match(api, /messageKind: row\.message_kind \?\? 'chat'/)
  assert.match(api, /updateRemoteStudentWorkoutFinishPreference/)
  assert.match(app, /role="switch"[\s\S]*aria-checked/)
  assert.match(app, /notifyCoachOnWorkoutFinish/)
  assert.match(app, /incomingMessage \|\| incomingWorkoutCompletion/)
  assert.match(studentsCss, /student-workout-notification-switch:focus-visible/)
  assert.match(app, /includes\(savedMessage\.sender\) && !workoutCompletionEvent/)
  assert.match(app, /sendRemoteWorkoutCompletionPush\(\{ workoutLogId: savedLog\.id, inviteCode: log\.inviteCode \}\)/)
})

test('Edge Function valida convite, propriedade do log e preferência antes do APNs, sem expor dados pessoais', async () => {
  assert.match(edgeFunction, /\.eq\('status', 'active'\)/)
  assert.match(edgeFunction, /String\(workoutLog\.coach_id\) !== String\(invite\.coach_id\)/)
  assert.match(edgeFunction, /notify_coach_on_workout_finish === false/)
  assert.match(edgeFunction, /claim_workout_completion_push_delivery/)
  assert.match(edgeFunction, /actor_type', 'coach'/)
  assert.match(edgeFunction, /event: 'student_workout_finished'/)
  assert.match(edgeFunction, /body: 'Um aluno encerrou uma sessão de treino\.'/)
  assert.doesNotMatch(edgeFunction, /body:\s*student\.name|body:\s*workoutLog\.title/)
  assert.match(supabaseConfig, /\[functions\.workout-completion-push\][\s\S]*?verify_jwt = false/)
  const transformed = await transformWithEsbuild(edgeFunction, 'workout-completion-push.ts', { loader: 'ts' })
  assert.ok(transformed.code.length > 0)
})
