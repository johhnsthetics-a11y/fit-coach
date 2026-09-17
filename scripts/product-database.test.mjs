const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
process.on('uncaughtException', error => { console.error({message:error.message, code:error.code, context:error.where, position:error.position}); process.exit(1) })
const db = new PGlite()
const coach='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', student='33333333-3333-4333-8333-333333333333', studentB='44444444-4444-4444-8444-444444444444'
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
create table students(id uuid primary key, coach_id uuid references auth.users(id));
create table workouts(id uuid primary key default gen_random_uuid(),coach_id uuid,student_id uuid references students(id),title text,focus text,notes text,active boolean,created_at timestamptz default now());
create table workout_exercises(id uuid primary key default gen_random_uuid(),workout_id uuid references workouts(id),name text,sets text,reps text,load text,rest text,muscle_group text,equipment text,instructions text,video_url text,image_url text,external_id text,order_index integer);
create table workout_logs(id uuid primary key default gen_random_uuid(),coach_id uuid,student_id uuid,workout_id uuid,title text,effort text,notes text,completed_at timestamptz default now());
create table student_invites(id uuid default gen_random_uuid(),coach_id uuid,student_id uuid,code text,status text,expires_at timestamptz,created_at timestamptz default now());
create table nutrition_plans(id uuid primary key default gen_random_uuid(),coach_id uuid,student_id uuid references students(id),title text,calories text,protein text,notes text,active boolean default true,created_at timestamptz default now());
create table nutrition_meals(id uuid primary key default gen_random_uuid(),nutrition_plan_id uuid references nutrition_plans(id) on delete cascade,name text,foods text,macros text,time_label text,order_index integer default 0);
insert into auth.users values('${coach}'),('${other}');
insert into students values('${student}','${coach}'),('${studentB}','${other}');
insert into student_invites(coach_id,student_id,code,status) values('${coach}','${student}','qa-invite-a','active'),('${other}','${studentB}','qa-invite-b','active');`)
for (const file of ['20260911_secure_workout_publish.sql','20260915_workout_flow_readiness.sql','20260916_questionnaire_sync.sql']) {
  await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
}
await db.exec(await readFile(new URL('../supabase/migrations/20260916_workout_session_integrity.sql',import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20260916_workout_session_integrity.sql',import.meta.url),'utf8'))
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${coach}',false);`)
const nutritionPayload={student_id:student,title:'Dieta QA',calories:'2200',protein:'160',notes:'QA',meals:[{name:'Almoco',foods:'Arroz e frango',macros:'P 45 C 70 G 12',time:'12:00',order_index:0}]}
const savedNutrition=(await db.query('select save_nutrition_plan($1::jsonb) as value',[JSON.stringify(nutritionPayload)])).rows[0].value
assert.equal(savedNutrition.student_id,student)
assert.equal(savedNutrition.coach_id,coach)
assert.equal(savedNutrition.nutrition_meals.length,1)
await assert.rejects(db.query('select save_nutrition_plan($1::jsonb)',[JSON.stringify({...nutritionPayload,student_id:studentB})]),/nao pertence|não pertence/i)
console.log('Nutrition: authenticated coach can save own student plan and cannot save another coach student PASS')
const payload={student_id:student,title:'Treino QA',publication_status:'published',request_id:'qa-publish-123456',exercises:[{name:'Supino',sets:'2',reps:'10'}]}
const result=await db.query('select save_coach_workout($1::jsonb) as value',[JSON.stringify(payload)])
const workout=result.rows[0].value.id
await assert.rejects(db.query('select save_coach_workout($1::jsonb)',[JSON.stringify({...payload,student_id:studentB})]),/nao pertence/)
await db.exec(`insert into nutrition_questionnaires(id,coach_id,title,questions) values('qa-form','${coach}','Preferencias','[{"id":"q1","type":"single","label":"Restricoes?","required":true,"options":["Nao","Outra"]}]');`)
const assigned=(await db.query('select assign_nutrition_questionnaire($1,$2) as value',['qa-form',student])).rows[0].value
assert.equal((await db.query('select assign_nutrition_questionnaire($1,$2) as value',['qa-form',student])).rows[0].value.id,assigned.id)
await assert.rejects(db.query('select assign_nutrition_questionnaire($1,$2)',['qa-form',studentB]),/nao pertence/)
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
assert.equal((await db.query('select * from nutrition_questionnaire_assignments')).rows.length,0)
await db.exec(`reset role; set role anon;`)
await assert.rejects(db.query('select submit_nutrition_questionnaire($1,$2,$3::jsonb)',['qa-invite-b',assigned.id,'{}']),/nao pertence/)
await assert.rejects(db.query('select submit_nutrition_questionnaire($1,$2,$3::jsonb)',['qa-invite-a',assigned.id,'{}']),/obrigatorias/)
await assert.rejects(db.query('select submit_nutrition_questionnaire($1,$2,$3::jsonb)',['qa-invite-a',assigned.id,'{"q1":{"value":"Outra"}}']),/Outra/)
const answers=JSON.stringify({q1:{value:'Outra',otherText:'Alergia',observation:'Observacao QA'}})
const response=(await db.query('select submit_nutrition_questionnaire($1,$2,$3::jsonb) as value',['qa-invite-a',assigned.id,answers])).rows[0].value
assert.equal(response.status,'Respondido'); assert.equal(response.answers.q1.otherText,'Alergia')
assert.deepEqual((await db.query('select submit_nutrition_questionnaire($1,$2,$3::jsonb) as value',['qa-invite-a',assigned.id,'{}'])).rows[0].value,response)
console.log('Questionnaire: ownership, assignment deduplication, Other, observations, required answers and completion replay PASS')
const execution={setLogs:{'0-0-1':{completed:true},'0-0-2':{completed:true}},updatedAt:new Date().toISOString()}
try {
  await assert.rejects(db.query('select complete_student_workout_session($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',['qa-invite-a',workout,'Treino QA','Moderado','','qa-session-123456',120,'{}']), /series/)
  await assert.rejects(db.query('select save_student_workout_session($1,$2,$3,$4::jsonb)',['qa-invite-b',workout,'qa-session-123456',JSON.stringify(execution)]), /nao pertence/)
  await assert.rejects(db.query('select submit_student_workout_log_once($1,$2,$3,$4,$5,$6)',['qa-invite-a',workout,'Treino QA','Moderado','','qa-legacy-123456']), /permission denied/)
  await db.query('select save_student_workout_session($1,$2,$3,$4::jsonb)',['qa-invite-a',workout,'qa-session-123456',JSON.stringify(execution)])
  const stale = (await db.query('select save_student_workout_session($1,$2,$3,$4::jsonb) as value',['qa-invite-a',workout,'qa-session-123456',JSON.stringify({setLogs:{},updatedAt:'2000-01-01T00:00:00Z'})])).rows[0].value
  assert.equal(stale.execution.setLogs['0-0-1'].completed,true)
  await db.query('select complete_student_workout_session($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',['qa-invite-a',workout,'Treino QA','Moderado','','qa-session-123456',120,JSON.stringify(execution)])
  await db.query('select complete_student_workout_session($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',['qa-invite-a',workout,'Treino QA','Moderado','','qa-session-123456',120,'{}'])
  await db.query('select complete_student_workout_session($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',['qa-invite-a',workout,'Treino QA','Moderado','','qa-session-123456',120,JSON.stringify(execution)])
  await db.exec('reset role')
  assert.equal((await db.query('select count(*)::int as n from workout_logs')).rows[0].n,1)
  console.log('Workout: partial progress, complete and duplicate retry PASS')
} catch(e) { console.error('WORKOUT ORIGINAL ERROR:', e.message, 'CONTEXT:',e.where); throw e }
await db.close()
