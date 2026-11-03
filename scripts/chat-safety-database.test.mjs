import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const coach = '11111111-1111-4111-8111-111111111111'
const studentUser = '22222222-2222-4222-8222-222222222222'
const outsider = '33333333-3333-4333-8333-333333333333'
const master = '44444444-4444-4444-8444-444444444444'
const student = '55555555-5555-4555-8555-555555555555'
const secondStudent = '66666666-6666-4666-8666-666666666666'
const invite = 'VALID-SECRET-TOKEN'

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text unique);
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table public.students (
      id uuid primary key, coach_id uuid references auth.users(id),
      auth_user_id uuid references auth.users(id), name text not null
    );
    create table public.student_invites (
      id uuid primary key default gen_random_uuid(),
      coach_id uuid, student_id uuid, code text unique,
      status text default 'active', expires_at timestamptz
    );
    create table public.messages (
      id uuid primary key default gen_random_uuid(),
      coach_id uuid, student_id uuid, sender text not null,
      body text not null, read boolean default false, deleted_at timestamptz,
      attachment_url text, attachment_type text, attachment_name text,
      created_at timestamptz default now()
    );
    create table public.admin_users (email text,role text,active boolean);
    alter table public.messages enable row level security;
    create policy coach_rw on public.messages for all to authenticated
      using (coach_id = auth.uid()) with check (coach_id=auth.uid());
    grant select on public.students to authenticated;
    grant select,insert,update on public.messages to authenticated;
    create function public.student_send_stub(p_code text,p_body text)
    returns uuid language plpgsql security definer set search_path = ''
    as $$
    declare result uuid; target record;
    begin
      select si.student_id,si.coach_id into target
      from public.student_invites si
      where si.code=p_code and si.status='active' and si.expires_at>now();
      if target.student_id is null then raise exception 'Invalid invite'; end if;
      insert into public.messages(student_id,coach_id,sender,body)
      values (target.student_id,target.coach_id,'student',p_body) returning id into result;
      return result;
    end $$;
    grant execute on function public.student_send_stub(text,text) to anon;
    insert into auth.users(id,email) values
      ('${coach}','coach@example.org'), ('${studentUser}','student@example.org'),
      ('${outsider}','outsider@example.org'), ('${master}','master@example.org');
    insert into public.admin_users(email,role,active) values ('master@example.org','master',true);
    insert into public.students(id,coach_id,auth_user_id,name) values
      ('${student}','${coach}','${studentUser}','Teste'),
      ('${secondStudent}','${coach}',null,'Outro');
    insert into public.student_invites(coach_id,student_id,code,status,expires_at)
      values ('${coach}','${student}','${invite}','active',now()+interval '30 days');
    insert into public.messages(coach_id,student_id,sender,body)
      values ('${coach}','${student}','student','Texto anterior'),
        ('${coach}','${student}','coach','Resposta anterior');
  `)
  const sql = await readFile(new URL('../supabase/migrations/20261103130000_chat_safety_reports_blocks.sql', import.meta.url),'utf8')
  await db.exec(sql)

  async function as(role, user='') {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false);`)
    await db.exec(`set role ${role};`)
  }
  async function rpc(name, params=[]) {
    return (await db.query(name,params)).rows[0]
  }

  await as('authenticated',coach)
  let status = await rpc('select public.chat_safety_status($1::uuid,null) as value',[student])
  assert.equal(status.value.blocked,false)
  await rpc('select public.chat_safety_set_block($1::uuid,true,null) as value',[student])
  status = await rpc('select public.chat_safety_status($1::uuid,null) as value',[student])
  assert.equal(status.value.blockedByYou,true)
  assert.equal(status.value.blocked,true)
  await assert.rejects(
    db.query("insert into public.messages(coach_id,student_id,sender,body) values ($1,$2,'coach','Nova mensagem')",[coach,student]),
    /bloqueado/i,
  )
  // Soft deletion remains possible, so no old health or financial data is erased.
  await db.query("update public.messages set body='Mensagem apagada',deleted_at=now() where student_id=$1 and sender='coach'",[student])

  await as('authenticated',outsider)
  await assert.rejects(rpc('select public.chat_safety_status($1::uuid,null) as value',[student]),/nao autorizado/i)
  await assert.rejects(rpc('select public.chat_safety_set_block($1::uuid,true,null) as value',[student]),/nao autorizado/i)
  await assert.rejects(rpc("select public.chat_safety_submit_report($1::uuid,'spam','',null,null) as id",[student]),/nao autorizado/i)

  await as('anon')
  status = await rpc('select public.chat_safety_status($1::uuid,$2) as value',[student,invite])
  assert.equal(status.value.blockedByOther,true)
  await assert.rejects(rpc('select public.student_send_stub($1,$2) as id',[invite,'Mensagem bloqueada']),/bloqueado/i)
  await rpc('select public.chat_safety_set_block($1::uuid,true,$2) as value',[student,invite])
  await as('authenticated',coach)
  await rpc('select public.chat_safety_set_block($1::uuid,false,null) as value',[student])
  status = await rpc('select public.chat_safety_status($1::uuid,null) as value',[student])
  assert.equal(status.value.blocked,true) // Coach cannot clear the student block.
  assert.equal(status.value.blockedByOther,true)

  await as('anon')
  await rpc('select public.chat_safety_set_block($1::uuid,false,$2) as value',[student,invite])
  await rpc('select public.student_send_stub($1,$2) as id',[invite,'Depois de desbloquear'])
  await as('authenticated',coach)
  const before=(await db.query("select id from public.messages where sender='coach' limit 1")).rows[0].id
  await as('anon')
  await assert.rejects(
    rpc("select public.chat_safety_submit_report($1::uuid,'harassment','', $2::uuid,$3) as id",[student,before+'bad',invite]),/invalid input syntax/i
  )
  const report=await rpc("select public.chat_safety_submit_report($1::uuid,'harassment','Texto inadequado',$2::uuid,$3) as id",[student,before,invite])
  assert.ok(report.id)
  await as('authenticated',coach)
  const ownStudentMessage=(await db.query("select id from public.messages where sender='student' limit 1")).rows[0].id
  await as('anon')
  await assert.rejects(
    rpc("select public.chat_safety_submit_report($1::uuid,'spam','', $2::uuid,$3) as id",[student,ownStudentMessage,invite]),
    /nao pertence/i
  )
  await as('authenticated',outsider)
  await assert.rejects(rpc('select public.chat_safety_admin_list_reports() as reports'),/negado/i)
  await as('authenticated',master)
  const list=await rpc('select public.chat_safety_admin_list_reports() as reports')
  assert.equal(list.reports.length,1)
  assert.equal(list.reports[0].id,report.id)
  assert.equal(list.reports[0].student_name,'Teste')
  const review=await rpc("select public.chat_safety_admin_update_report($1::uuid,'resolved') as done",[report.id])
  assert.equal(review.done,true)
  await as('anon')
  await assert.rejects(db.query("select * from public.chat_safety_reports"),/permission denied|row-level security/i)
  await assert.rejects(db.query("select * from public.chat_safety_blocks"),/permission denied|row-level security/i)
  console.log('Chat safety DB: unauthorized access, both roles, block, history, reports, admin review PASS')
} finally {
  await db.close()
}
