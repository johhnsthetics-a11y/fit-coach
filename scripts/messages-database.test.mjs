const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const db = new PGlite()
const coach = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const student = '33333333-3333-4333-8333-333333333333'
const studentB = '44444444-4444-4444-8444-444444444444'

await db.exec(`
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create table public.students(
  id uuid primary key,
  coach_id uuid references auth.users(id)
);
create table public.student_invites(
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references auth.users(id),
  student_id uuid references public.students(id),
  code text not null unique,
  status text default 'active',
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now()
);
create table public.messages(
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references auth.users(id),
  student_id uuid references public.students(id),
  sender text not null check (sender in ('coach','student')),
  body text not null,
  read boolean default false,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  created_at timestamptz default now()
);

alter table public.students enable row level security;
alter table public.messages enable row level security;
grant select on public.students to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

create policy "coach can manage own students"
on public.students for all to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

create policy "coach can manage own messages"
on public.messages for all to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

insert into auth.users values ('${coach}'), ('${other}');
insert into public.students values ('${student}', '${coach}'), ('${studentB}', '${other}');
insert into public.student_invites (coach_id, student_id, code, status, expires_at)
values ('${coach}', '${student}', 'INVITE-QA', 'active', now() + interval '1 day');
`)

await db.exec(await readFile(new URL('../supabase/migrations/20260917_repair_message_rls_42501.sql', import.meta.url), 'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20260917_secure_message_edit_delete.sql', import.meta.url), 'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20260918_soft_delete_messages.sql', import.meta.url), 'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20260920_idempotent_chat_messages.sql', import.meta.url), 'utf8'))
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${coach}',false);`)

const normalized = await db.query(`
  insert into public.messages (coach_id, student_id, sender, body, read)
  values ($1, $2, 'coach', 'Mensagem QA', false)
  returning coach_id, student_id, sender
`, [other, student])

assert.equal(normalized.rows[0].coach_id, coach)
assert.equal(normalized.rows[0].student_id, student)
assert.equal(normalized.rows[0].sender, 'coach')

await assert.rejects(
  db.query(`
    insert into public.messages (coach_id, student_id, sender, body, read)
    values ($1, $2, 'coach', 'Mensagem indevida', false)
  `, [coach, studentB]),
  /nao pertence|row-level security|42501/i,
)

const studentMessage = await db.query(`
  insert into public.messages (coach_id, student_id, sender, body, read, attachment_url, attachment_type, attachment_name)
  values ($1, $2, 'student', 'Original do aluno', false, 'private/original.jpg', 'image/jpeg', 'original.jpg')
  returning id
`, [coach, student])

await db.exec('reset role;')
await db.exec(`select set_config('request.jwt.claim.sub','',false);`)

const studentEdit = await db.query(
  `select public.update_student_message($1::text, $2::uuid, $3::text) as message`,
  ['INVITE-QA', studentMessage.rows[0].id, 'Editada pelo aluno'],
)
assert.ok(studentEdit.rows[0].message)

const studentDelete = await db.query(
  `select (public.delete_student_message($1::text, $2::uuid)).* `,
  ['INVITE-QA', studentMessage.rows[0].id],
)
assert.equal(studentDelete.rows[0].body, 'Mensagem apagada')
assert.ok(studentDelete.rows[0].deleted_at)
assert.equal(studentDelete.rows[0].attachment_url, null)
assert.equal(studentDelete.rows[0].attachment_type, null)
assert.equal(studentDelete.rows[0].attachment_name, null)

const preserved = await db.query(
  `select body, deleted_at, attachment_url from public.messages where id = $1`,
  [studentMessage.rows[0].id],
)
assert.equal(preserved.rows.length, 1)
assert.equal(preserved.rows[0].body, 'Mensagem apagada')
assert.ok(preserved.rows[0].deleted_at)
assert.equal(preserved.rows[0].attachment_url, null)

const clientMessageId = '55555555-5555-4555-8555-555555555555'
const firstRetry = await db.query(
  `select (public.submit_student_message($1, $2, null, null, null, $3::uuid)).*`,
  ['INVITE-QA', 'Mensagem idempotente', clientMessageId],
)
const secondRetry = await db.query(
  `select (public.submit_student_message($1, $2, null, null, null, $3::uuid)).*`,
  ['INVITE-QA', 'Mensagem idempotente', clientMessageId],
)
assert.equal(firstRetry.rows[0].id, clientMessageId)
assert.equal(secondRetry.rows[0].id, clientMessageId)
const retryCount = await db.query('select count(*)::int as total from public.messages where id = $1', [clientMessageId])
assert.equal(retryCount.rows[0].total, 1)

console.log('Messages: ownership, edit and soft delete contracts PASS')
await db.close()
