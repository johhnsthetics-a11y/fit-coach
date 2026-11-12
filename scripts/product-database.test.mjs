const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
process.on('uncaughtException', error => { console.error({message:error.message, code:error.code, context:error.where, position:error.position}); process.exit(1) })
const db = new PGlite()
const coach='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', student='33333333-3333-4333-8333-333333333333', studentB='44444444-4444-4444-8444-444444444444'
const nutritionist='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', trainer='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const studentUser='cccccccc-cccc-4ccc-8ccc-cccccccccccc', studentUserB='dddddddd-dddd-4ddd-8ddd-dddddddddddd', studentC='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', studentUserC='ffffffff-ffff-4fff-8fff-ffffffffffff'
const appleProfessional='12345678-1234-4abc-8def-123456789abc', noEntitlement='87654321-4321-4abc-8def-cba987654321'
const foreignWorkout='55555555-5555-4555-8555-555555555555', legacyDraft='66666666-6666-4666-8666-666666666666', legacyArchived='77777777-7777-4777-8777-777777777777'
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon;
  create table public.users(id uuid primary key, name text not null, email text unique not null, role text not null);
  create table public.coach_subscriptions(coach_id uuid primary key, status text, current_period_ends_at timestamptz);
  create table public.affiliate_professionals(email text primary key, active boolean not null default false);
  create table students(id uuid primary key, coach_id uuid references auth.users(id), name text default '', goal text, phase text, weight text, body_fat text, calories text, protein text);
create table workouts(id uuid primary key default gen_random_uuid(),coach_id uuid,student_id uuid references students(id),title text,focus text,notes text,active boolean,created_at timestamptz default now());
create table workout_exercises(id uuid primary key default gen_random_uuid(),workout_id uuid references workouts(id),name text,sets text,reps text,load text,rest text,muscle_group text,equipment text,instructions text,video_url text,image_url text,external_id text,order_index integer);
create table workout_logs(id uuid primary key default gen_random_uuid(),coach_id uuid,student_id uuid,workout_id uuid,title text,effort text,notes text,completed_at timestamptz default now());
create table student_invites(id uuid default gen_random_uuid(),coach_id uuid,student_id uuid,code text,status text,expires_at timestamptz,created_at timestamptz default now());
create table checkins(id uuid primary key default gen_random_uuid(),coach_id uuid,student_id uuid,type text,due_label text,state text,weight text,note text,created_at timestamptz default now());
create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid,title text,body text,read boolean default false);
create table nutrition_plans(id uuid primary key default gen_random_uuid(),coach_id uuid,student_id uuid references students(id),title text,calories text,protein text,notes text,active boolean default true,created_at timestamptz default now());
create table nutrition_meals(id uuid primary key default gen_random_uuid(),nutrition_plan_id uuid references nutrition_plans(id) on delete cascade,name text,foods text,macros text,time_label text,order_index integer default 0);
insert into auth.users values('${coach}'),('${other}'),('${nutritionist}'),('${trainer}'),('${studentUser}'),('${studentUserB}'),('${studentUserC}'),('${appleProfessional}'),('${noEntitlement}');
insert into public.users(id,name,email,role) values
  ('${coach}','Coach QA','coach@example.com','coach'),
  ('${other}','Nutri proprietária QA','owner.nutri@example.com','nutritionist'),
  ('${nutritionist}','Nutricionista parceira QA','nutritionist@example.com','nutritionist'),
  ('${trainer}','Treinador parceiro QA','trainer@example.com','coach'),
  ('${appleProfessional}','Treinador Apple QA','apple@example.com','coach'),
  ('${noEntitlement}','Treinador sem acesso QA','no-access@example.com','coach');
insert into coach_subscriptions(coach_id,status,current_period_ends_at) values
  ('${coach}','active',now()+interval '1 day'),
  ('${other}','paid',now()+interval '1 day'),
  ('${nutritionist}','trialing',now()+interval '1 day');
insert into affiliate_professionals(email,active) values('trainer@example.com',true);
insert into students(id,coach_id,name) values('${student}','${coach}','Aluno QA'),('${studentB}','${other}','Aluno externo'),('${studentC}','${nutritionist}','Paciente da nutri');
insert into student_invites(coach_id,student_id,code,status) values('${coach}','${student}','qa-invite-a','active'),('${other}','${studentB}','qa-invite-b','active');
insert into workouts(id,coach_id,student_id,title,active) values
  ('${foreignWorkout}','${other}','${studentB}','Treino externo',true),
  ('${legacyDraft}','${coach}','${student}','Rascunho legado',false),
  ('${legacyArchived}','${coach}','${student}','Treino arquivado legado',false);
insert into workout_logs(coach_id,student_id,workout_id,title) values('${coach}','${student}','${legacyArchived}','Treino arquivado legado');`)
await db.exec(`create function public.submit_student_checkin(invite_code text,checkin_type text,due_label text,checkin_state text,weight_value text,note_value text)
returns public.checkins language plpgsql security definer set search_path='' as $$
declare saved public.checkins%rowtype;
begin
  insert into public.checkins(coach_id,student_id,type,due_label,state,weight,note)
  select coach_id,student_id,checkin_type,due_label,checkin_state,weight_value,note_value
  from public.student_invites where code=invite_code and status='active' limit 1
  returning * into saved;
  return saved;
end; $$;
grant execute on function public.submit_student_checkin(text,text,text,text,text,text) to anon,authenticated;`)
const migrationFiles = await readdir(new URL('../supabase/migrations/', import.meta.url))
const workoutLifecycleMigration = migrationFiles.find((file) => /_workout_publication_lifecycle\.sql$/.test(file))
assert.ok(workoutLifecycleMigration, 'workout publication lifecycle migration must exist')
const workoutConsistencyMigration = migrationFiles.find((file) => /_workout_publication_consistency\.sql$/.test(file))
assert.ok(workoutConsistencyMigration, 'workout publication consistency migration must exist')
for (const file of ['20260917_repair_nutrition_rls_42501.sql','20260911_secure_workout_publish.sql','20260915_workout_flow_readiness.sql',workoutLifecycleMigration]) {
  await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
}
const legacyStates=(await db.query('select id, publication_status from workouts where id in ($1,$2) order by id',[legacyDraft,legacyArchived])).rows
assert.deepEqual(legacyStates.map(({id,publication_status})=>[id,publication_status]),[[legacyDraft,'draft'],[legacyArchived,'archived']])
await db.exec(`update workouts set active=false where id='${foreignWorkout}'`)
assert.deepEqual((await db.query('select publication_status,active from workouts where id=$1',[foreignWorkout])).rows[0],{publication_status:'published',active:false})
await db.exec(await readFile(new URL('../supabase/migrations/'+workoutConsistencyMigration,import.meta.url),'utf8'))
assert.deepEqual((await db.query('select publication_status,active from workouts where id=$1',[foreignWorkout])).rows[0],{publication_status:'archived',active:false})
await db.exec(await readFile(new URL('../supabase/migrations/20260916_questionnaire_sync.sql',import.meta.url),'utf8'))
await db.exec(`update workouts set active=false where id='${foreignWorkout}'`)
assert.deepEqual((await db.query('select publication_status,active from workouts where id=$1',[foreignWorkout])).rows[0],{publication_status:'archived',active:false})
await db.exec(`update workouts set publication_status='draft',active=true where id='${foreignWorkout}'`)
assert.deepEqual((await db.query('select publication_status,active from workouts where id=$1',[foreignWorkout])).rows[0],{publication_status:'draft',active:false})
await db.exec(await readFile(new URL('../supabase/migrations/20260916_workout_session_integrity.sql',import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20260916_workout_session_integrity.sql',import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20261020120000_fix_workout_day_cardio_validation.sql',import.meta.url),'utf8'))
const multiDayWorkout='88888888-8888-4888-8888-888888888888', cardioWorkout='99999999-9999-4999-8999-999999999999'
const multiDayMeta=JSON.stringify({days:[
  {day:'Dia A',exercises:[{name:'Supino',sets:'2'}]},
  {day:'Dia B',exercises:[{name:'Agachamento',sets:'3'}]},
]})
const cardioMeta=JSON.stringify({days:[
  {day:'Cardio',exercises:[{name:'Esteira',exerciseType:'cardio',cardioMode:'treadmill'}]},
]})
await db.query(`insert into workouts(id,coach_id,student_id,title,notes,active,publication_status) values
  ($1,$2,$3,'Treino multi-dia',$4,true,'published'),
  ($5,$2,$3,'Treino cardio',$6,true,'published')`, [multiDayWorkout,coach,student,'[coachfitpro-workout-meta]'+multiDayMeta,cardioWorkout,'[coachfitpro-workout-meta]'+cardioMeta])
await db.query('select validate_workout_execution($1,$2::jsonb)', [multiDayWorkout,JSON.stringify({activeDayIndex:0,setLogs:{'0-0-1':{completed:true},'0-0-2':{completed:true}}})])
await db.query('select validate_workout_execution($1,$2::jsonb)', [cardioWorkout,JSON.stringify({activeDayIndex:0,cardioLogs:{'0-0':{status:'completed',completed:true}}})])
await assert.rejects(
  db.query('select validate_workout_execution($1,$2::jsonb)', [cardioWorkout,JSON.stringify({activeDayIndex:0,cardioLogs:{'0-0':{status:'paused',completed:false}}})]),
  /cardiovascular|cardio/i,
)
await db.exec(await readFile(new URL('../supabase/migrations/20261020121500_notify_coach_on_student_checkin.sql',import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20261112152900_professional_team_patient_collaboration_build41.sql',import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20261112163114_allow_unsubscribed_team_invitees.sql',import.meta.url),'utf8'))
await db.exec(`update students set auth_user_id='${studentUser}' where id='${student}';
update students set auth_user_id='${studentUserB}' where id='${studentB}';
update students set auth_user_id='${studentUserC}' where id='${studentC}';`)
await db.query(`insert into professional_apple_subscription_entitlements
  (original_transaction_id,owner_professional_id,transaction_id,product_id,apple_environment,status_code,expires_at,last_verified_at)
  values ('100000000000000001','${appleProfessional}','100000000000000002','br.com.coachfitpro.ios.profissional.mensal','Sandbox',1,now()+interval '1 day',now())`)
await db.exec('set role anon')
await db.query('select submit_student_checkin($1,$2,$3,$4,$5,$6)',['qa-invite-a','Semanal','Hoje','Concluido','80','Tudo certo'])
await db.exec('reset role')
assert.deepEqual(
  (await db.query('select user_id,title,body,read from notifications')).rows,
  [{user_id:coach,title:'Novo check-in recebido',body:'Aluno QA enviou um novo check-in.',read:false}],
)
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
assert.equal(result.rows[0].value.publication_status,'published')
assert.equal(result.rows[0].value.active,true)
const draftPayload={...payload,title:'Rascunho QA',publication_status:'draft',request_id:'qa-draft-123456'}
const draft=(await db.query('select save_coach_workout($1::jsonb) as value',[JSON.stringify(draftPayload)])).rows[0].value
assert.equal(draft.publication_status,'draft')
assert.equal(draft.active,false)
const republished=(await db.query('select save_coach_workout($1::jsonb) as value',[JSON.stringify({...draftPayload,id:draft.id,publication_status:'published'})])).rows[0].value
assert.equal(republished.publication_status,'published')
assert.equal(republished.active,true)
await assert.rejects(db.query('select save_coach_workout($1::jsonb)',[JSON.stringify({...payload,student_id:studentB})]),/nao pertence/)
await assert.rejects(db.query('select save_coach_workout($1::jsonb)',[JSON.stringify({...payload,id:foreignWorkout,student_id:student})]),/Treino nao encontrado/)
await db.exec(`insert into nutrition_questionnaires(id,coach_id,title,questions) values('qa-form','${coach}','Preferencias','[{"id":"q1","type":"single","label":"Restricoes?","required":true,"options":["Nao","Outra"]}]');`)
const assigned=(await db.query('select assign_nutrition_questionnaire($1,$2) as value',['qa-form',student])).rows[0].value
assert.equal((await db.query('select assign_nutrition_questionnaire($1,$2) as value',['qa-form',student])).rows[0].value.id,assigned.id)
await assert.rejects(db.query('select assign_nutrition_questionnaire($1,$2)',['qa-form',studentB]),/nao pertence/)
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
assert.equal((await db.query('select * from nutrition_questionnaire_assignments')).rows.length,0)
await db.exec(`reset role; set role anon;`)
await assert.rejects(db.query('select save_coach_workout($1::jsonb)',[JSON.stringify(payload)]),/permission denied/i)
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
  assert.equal((await db.query('select count(*)::int as n from workout_logs where workout_id = $1',[workout])).rows[0].n,1)
  console.log('Workout: partial progress, complete and duplicate retry PASS')
} catch(e) { console.error('WORKOUT ORIGINAL ERROR:', e.message, 'CONTEXT:',e.where); throw e }

async function assumeUser(userId) {
  await db.exec('reset role')
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false);`)
}

await assumeUser(noEntitlement)
await assert.rejects(
  db.query("select create_professional_team('Sem assinatura')"),
  /assinatura profissional não está ativa/i,
)
await assumeUser(appleProfessional)
await assert.rejects(db.query('select * from professional_apple_subscription_entitlements'), /permission denied|row-level security/i)
assert.equal((await db.query("select create_professional_team('Equipe Apple QA') as value")).rows[0].value.name, 'Equipe Apple QA')
await db.exec('reset role')
await assert.rejects(
  db.query('update professional_apple_subscription_entitlements set owner_professional_id=$1 where original_transaction_id=$2', [coach,'100000000000000001']),
  /vinculada a outra conta/i,
)
await db.query("update professional_apple_subscription_entitlements set last_verified_at=now()-interval '2 minutes' where original_transaction_id='100000000000000001'")
await assumeUser(appleProfessional)
await assert.rejects(db.query("select create_professional_team('Entitlement Apple expirado')"), /assinatura profissional não está ativa/i)
await db.exec('reset role')
await db.query("update professional_apple_subscription_entitlements set status_code=4,expires_at=now()-interval '1 day',grace_expires_at=now()+interval '30 minutes',last_verified_at=now() where original_transaction_id='100000000000000001'")
await assumeUser(appleProfessional)
assert.equal((await db.query('select get_professional_team_workspace() as value')).rows[0].value.teams.length, 1)
await db.exec('reset role')
await db.query("update professional_apple_subscription_entitlements set grace_expires_at=now()-interval '1 minute',last_verified_at=now() where original_transaction_id='100000000000000001'")
await assumeUser(appleProfessional)
await assert.rejects(db.query("select create_professional_team('Grace Apple expirado')"), /assinatura profissional não está ativa/i)

await assumeUser(coach)
const teamA = (await db.query("select create_professional_team('Equipe Coach QA') as value")).rows[0].value
const teamInvite = (await db.query('select create_professional_team_invite($1::uuid,$2,$3) as value', [teamA.id,'nutritionist@example.com','nutritionist'])).rows[0].value
assert.equal(teamInvite.status, 'pending')
const noSubscriptionInvite = (await db.query('select create_professional_team_invite($1::uuid,$2,$3) as value', [teamA.id,'no-access@example.com','trainer'])).rows[0].value
await assumeUser(noEntitlement)
await db.query('select accept_professional_team_invite($1::uuid)', [noSubscriptionInvite.id])
assert.equal((await db.query('select get_professional_team_workspace() as value')).rows[0].value.teams[0].members.length, 1)
await db.exec('reset role')
await assumeUser(coach)
await assert.rejects(
  db.query('select create_professional_team_invite($1::uuid,$2,$3)', [teamA.id,'trainer@example.com','nutritionist']),
  /papel selecionado/i,
)

await assumeUser(nutritionist)
assert.equal((await db.query('select get_professional_team_workspace() as value')).rows[0].value.pendingInvites.length, 1)
await db.query('select accept_professional_team_invite($1::uuid)', [teamInvite.id])
assert.deepEqual((await db.query("select get_professional_delegated_workspace('nutrition') as value")).rows[0].value, [])
const nutritionistTeamView = (await db.query('select get_professional_team_workspace() as value')).rows[0].value
assert.equal(nutritionistTeamView.teams.length, 1)
assert.equal(nutritionistTeamView.teams[0].isOwner, false)

await assumeUser(coach)
const ownedCandidates = (await db.query('select list_professional_team_candidates() as value')).rows[0].value
assert.deepEqual(ownedCandidates.map((candidate) => candidate.id), [student])
await db.query('select replace_professional_patient_delegations($1::uuid,$2::uuid,$3,$4::uuid[])', [teamA.id,nutritionist,'nutrition',`{${student}}`])

await assumeUser(studentUser)
const consentRequests = (await db.query('select get_current_student_collaboration_requests() as value')).rows[0].value
assert.equal(consentRequests.length, 1)
assert.equal(consentRequests[0].area, 'nutrition')
const nutritionConsentId = consentRequests[0].delegationId
await db.query("select respond_to_professional_collaboration($1::uuid,'accept')", [nutritionConsentId])
const acceptedConsentRequests = (await db.query('select get_current_student_collaboration_requests() as value')).rows[0].value
assert.equal(acceptedConsentRequests.length, 1)
assert.equal(acceptedConsentRequests[0].consentStatus, 'accepted')

await assumeUser(coach)
await db.query('select replace_professional_patient_delegations($1::uuid,$2::uuid,$3,$4::uuid[])', [teamA.id,noEntitlement,'workout',`{${student}}`])
await assumeUser(studentUser)
const guestWorkoutRequest = (await db.query('select get_current_student_collaboration_requests() as value')).rows[0].value.find(request => request.area === 'workout')
assert.ok(guestWorkoutRequest)
await db.query("select respond_to_professional_collaboration($1::uuid,'accept')", [guestWorkoutRequest.delegationId])
await assumeUser(noEntitlement)
assert.equal((await db.query('select get_professional_team_workspace() as value')).rows[0].value.teams.length, 1)
const guestWorkoutWorkspace = (await db.query("select get_professional_delegated_workspace('workout') as value")).rows[0].value
assert.equal(guestWorkoutWorkspace.length, 1)
assert.equal(guestWorkoutWorkspace[0].student.id, student)
const guestWorkout = (await db.query('select save_collaborative_workout($1::jsonb) as value', [JSON.stringify({
  student_id: student, title: 'Treino autorizado sem assinatura própria', publication_status: 'published', request_id: 'guest-no-subscription-001',
  exercises: [{ name: 'Agachamento', sets: '3', reps: '8' }],
})])).rows[0].value
assert.equal(guestWorkout.coach_id, coach)
assert.equal(guestWorkout.created_by, noEntitlement)
await db.exec('reset role')

await assumeUser(coach)
const ownerNutritionWorkspace = (await db.query("select get_professional_delegated_workspace('nutrition') as value")).rows[0].value
assert.equal(ownerNutritionWorkspace.length, 1)
assert.deepEqual(Object.keys(ownerNutritionWorkspace[0]).sort(), ['delegationId', 'nutritionPlans', 'ownerName', 'ownerProfessionalId', 'student'])
assert.equal(ownerNutritionWorkspace[0].student.id, student)
await assert.rejects(
  db.query('select save_collaborative_nutrition_plan($1::jsonb)', [JSON.stringify({ student_id: student, title: 'Trainer cannot author collaborator plan', meals: [] })]),
  /Somente uma conta de nutricionista/i,
)

await assumeUser(nutritionist)
const nutritionWorkspace = (await db.query("select get_professional_delegated_workspace('nutrition') as value")).rows[0].value
assert.equal(nutritionWorkspace.length, 1)
assert.deepEqual(Object.keys(nutritionWorkspace[0]).sort(), ['delegationId', 'nutritionPlans', 'ownerName', 'ownerProfessionalId', 'student'])
assert.deepEqual(Object.keys(nutritionWorkspace[0].student).sort(), ['bodyFat', 'calories', 'goal', 'id', 'name', 'phase', 'protein', 'weight'])
assert.equal(nutritionWorkspace[0].student.id, student)
assert.equal(nutritionWorkspace[0].nutritionPlans.length, 1)
assert.equal(nutritionWorkspace[0].nutritionPlans[0].coach_id, coach)
await assert.rejects(db.query('select id from students where id=$1', [student]), /permission denied|row-level security/i)
const collaborativeDiet = (await db.query('select save_collaborative_nutrition_plan($1::jsonb) as value', [JSON.stringify({
  student_id: student, title: 'Plano colaborativo QA', calories: '1800', protein: '120', notes: 'Plano elaborado pelo profissional autorizado',
  meals: [{ name: 'Almoço', foods: 'Refeição QA', macros: 'P 40 g', time: '12:00', order_index: 0 }],
})])).rows[0].value
assert.equal(collaborativeDiet.coach_id, coach)
assert.equal(collaborativeDiet.created_by, nutritionist)
assert.equal(collaborativeDiet.nutrition_meals.length, 1)
const existingCollaborativeMealId = collaborativeDiet.nutrition_meals[0].id
const updatedCollaborativeDiet = (await db.query('select save_collaborative_nutrition_plan($1::jsonb) as value', [JSON.stringify({
  id: collaborativeDiet.id, student_id: student, title: 'Plano colaborativo QA atualizado', calories: '1900', protein: '125', notes: 'Notas atualizadas',
  meals: [
    { id: existingCollaborativeMealId, name: 'Almoço atualizado', foods: 'Refeição QA editada', macros: 'P 45 g', time: '13:00', order_index: 0 },
    { name: 'Lanche', foods: 'Iogurte QA', macros: 'P 15 g', time: '16:00', order_index: 1 },
  ],
})])).rows[0].value
assert.equal(updatedCollaborativeDiet.nutrition_meals.length, 2)
assert.equal(updatedCollaborativeDiet.nutrition_meals[0].id, existingCollaborativeMealId)
assert.equal(updatedCollaborativeDiet.nutrition_meals[0].time_label, '13:00')
await db.exec('reset role')
const ownedDiet = (await db.query('select coach_id,created_by from nutrition_plans where id=$1', [collaborativeDiet.id])).rows[0]
assert.deepEqual(ownedDiet, { coach_id: coach, created_by: nutritionist })
await db.exec('set role anon')
const studentProfessionals = (await db.query('select get_student_professional_collaborators($1) as value', ['qa-invite-a'])).rows[0].value
assert.equal(studentProfessionals.length, 2)
assert.deepEqual(studentProfessionals.map(professional => professional.professionalName).sort(), ['Nutricionista parceira QA', 'Treinador sem acesso QA'].sort())

await assumeUser(studentUser)
await db.query("select respond_to_professional_collaboration($1::uuid,'revoke')", [nutritionConsentId])
await assumeUser(nutritionist)
assert.deepEqual((await db.query("select get_professional_delegated_workspace('nutrition') as value")).rows[0].value, [])
await assert.rejects(
  db.query('select save_collaborative_nutrition_plan($1::jsonb)', [JSON.stringify({ student_id: student, title: 'Acesso revogado', meals: [] })]),
  /consentimento foi revogado/i,
)

const teamB = (await db.query("select create_professional_team('Equipe da Nutri QA') as value")).rows[0].value
const trainerInvite = (await db.query('select create_professional_team_invite($1::uuid,$2,$3) as value', [teamB.id,'trainer@example.com','trainer'])).rows[0].value
await assumeUser(trainer)
await db.query('select accept_professional_team_invite($1::uuid)', [trainerInvite.id])
await assumeUser(nutritionist)
await db.query('select replace_professional_patient_delegations($1::uuid,$2::uuid,$3,$4::uuid[])', [teamB.id,trainer,'workout',`{${studentC}}`])
const multiTeamWorkspace = (await db.query('select get_professional_team_workspace() as value')).rows[0].value
assert.equal(multiTeamWorkspace.teams.length, 2)
assert.equal(multiTeamWorkspace.teams.find((teamView) => teamView.id === teamB.id).isOwner, true)
assert.equal(multiTeamWorkspace.teams.find((teamView) => teamView.id === teamA.id).isOwner, false)

await assumeUser(studentUserC)
const workoutConsent = (await db.query('select get_current_student_collaboration_requests() as value')).rows[0].value
assert.equal(workoutConsent.length, 1)
assert.equal(workoutConsent[0].area, 'workout')
await db.query("select respond_to_professional_collaboration($1::uuid,'accept')", [workoutConsent[0].delegationId])

await assumeUser(nutritionist)
const ownerWorkoutWorkspace = (await db.query("select get_professional_delegated_workspace('workout') as value")).rows[0].value
assert.equal(ownerWorkoutWorkspace.length, 1)
assert.deepEqual(Object.keys(ownerWorkoutWorkspace[0]).sort(), ['delegationId', 'ownerName', 'ownerProfessionalId', 'student', 'workoutLogs', 'workouts'])
assert.deepEqual(Object.keys(ownerWorkoutWorkspace[0].student).sort(), ['goal', 'id', 'name', 'phase'])
assert.equal(ownerWorkoutWorkspace[0].student.id, studentC)
await assert.rejects(
  db.query('select save_collaborative_workout($1::jsonb)', [JSON.stringify({ student_id: studentC, title: 'Owner sem permissão', exercises: [] })]),
  /Somente uma conta de treinador/i,
)

await assumeUser(trainer)
const workoutWorkspace = (await db.query("select get_professional_delegated_workspace('workout') as value")).rows[0].value
assert.equal(workoutWorkspace.length, 1)
assert.deepEqual(Object.keys(workoutWorkspace[0]).sort(), ['delegationId', 'ownerName', 'ownerProfessionalId', 'student', 'workoutLogs', 'workouts'])
assert.deepEqual(Object.keys(workoutWorkspace[0].student).sort(), ['goal', 'id', 'name', 'phase'])
assert.equal(workoutWorkspace[0].student.id, studentC)
await assert.rejects(db.query("select get_professional_delegated_workspace('nutrition') as value"), /área solicitada não corresponde/i)
const collaborativeWorkout = (await db.query('select save_collaborative_workout($1::jsonb) as value', [JSON.stringify({
  student_id: studentC, title: 'Treino colaborativo QA', focus: 'Força', publication_status: 'published', request_id: 'build41-collab-request-001',
  exercises: [{ name: 'Agachamento', sets: '3', reps: '8', load: '40', rest: '90', muscle_group: 'Pernas', equipment: 'Barra', instructions: 'Execução controlada' }],
})])).rows[0].value
assert.equal(collaborativeWorkout.coach_id, nutritionist)
assert.equal(collaborativeWorkout.created_by, trainer)
assert.equal(collaborativeWorkout.workout_exercises.length, 1)
await db.exec('reset role')
const ownedWorkout = (await db.query('select coach_id,created_by from workouts where id=$1', [collaborativeWorkout.id])).rows[0]
assert.deepEqual(ownedWorkout, { coach_id: nutritionist, created_by: trainer })

await assumeUser(nutritionist)
await db.query('select leave_professional_team($1::uuid)', [teamA.id])
const afterIndependentLeave = (await db.query('select get_professional_team_workspace() as value')).rows[0].value
assert.deepEqual(afterIndependentLeave.teams.map((teamView) => teamView.id), [teamB.id])
assert.equal(afterIndependentLeave.teams[0].isOwner, true)
await assumeUser(trainer)
assert.equal((await db.query('select get_professional_team_workspace() as value')).rows[0].value.teams.length, 1)
console.log('Professional collaboration: multi-team membership, per-patient consent, scoped nutrition/workout access, owner preservation and independent leave PASS')
await db.close()
