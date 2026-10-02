import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('resposta de uma sessão encerrada não retorna dados para a próxima conta', async (t) => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  t.after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow })
  globalThis.window = { setTimeout, clearTimeout }
  const referralSource = await readFile(new URL('../src/professionalReferral.js', import.meta.url), 'utf8')
  const referralModuleUrl = 'data:text/javascript;base64,' + Buffer.from(referralSource).toString('base64')
  const source = (await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8'))
    .replaceAll('import.meta.env.', '({VITE_SUPABASE_URL:"https://qa.invalid",VITE_SUPABASE_ANON_KEY:"qa-public-key"}).')
    .replace("'./professionalReferral'", `'${referralModuleUrl}'`)
  const api = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
  let respond
  globalThis.fetch = () => new Promise(resolve => { respond = resolve })
  api.setSupabaseSession('qa-session-a')
  const pending = api.saveRemoteNutritionQuestionnaire({id:'qa',title:'QA',questions:[]},'11111111-1111-4111-8111-111111111111')
  api.setSupabaseSession('qa-session-b')
  respond(new Response(JSON.stringify([{id:'qa',coach_id:'coach-a'}]), { status:200 }))
  await assert.rejects(pending, /sessão mudou/)
})

test('service worker não intercepta APIs, convites ou respostas autenticadas', async () => {
  const listeners = {}
  const source = await readFile(new URL('../public/service-worker.js', import.meta.url),'utf8')
  vm.runInNewContext(source, {
    URL, Response,
    self: { location:{origin:'https://qa.invalid'}, addEventListener:(name,handler)=>listeners[name]=handler },
  })
  for (const path of ['/api/data','/assets/photo.png?token=secret','/rest/v1/workouts']) {
    let intercepted = false
    listeners.fetch({request:new Request('https://qa.invalid'+path), respondWith:()=>{intercepted=true}})
    assert.equal(intercepted,false,path)
  }
  let intercepted = false
  listeners.fetch({ request:new Request('https://qa.invalid/private.png',{headers:{Authorization:'Bearer private'}}), respondWith:()=>{intercepted=true} })
  assert.equal(intercepted,false)
})

test('service worker preserva caches de outros aplicativos na mesma origem', async () => {
  const listeners = {}, removed = []
  let finished
  vm.runInNewContext(await readFile(new URL('../public/service-worker.js',import.meta.url),'utf8'), {
    self:{addEventListener:(name,handler)=>listeners[name]=handler,clients:{claim:async()=>{}}},
    caches:{keys:async()=>['unrelated-app','coach-fit-pro-old'],delete:async name=>removed.push(name)},
  })
  listeners.activate({waitUntil:promise=>{finished=promise}})
  await finished
  assert.deepEqual(removed,['coach-fit-pro-old'])
})

test('foto de check-in usa nome unico sem exigir permissao de upsert do aluno', async () => {
  const source = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const uploadFunction = source.match(/async function uploadCheckinPhoto[\s\S]*?\n}/)?.[0] || ''

  assert.match(uploadFunction, /Date\.now\(\)/)
  assert.doesNotMatch(uploadFunction, /['"]x-upsert['"]\s*:\s*['"]true['"]/)
})

test('storage valida convite ativo sem reabrir a tabela de convites ao anonimo', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260928_fix_student_checkin_photo_storage_rls.sql', import.meta.url), 'utf8')

  assert.match(migration, /create schema if not exists private/i)
  assert.match(migration, /private\.coachfit_valid_student_checkin_photo_path/i)
  assert.match(migration, /security definer/i)
  assert.match(migration, /revoke all on function private\.coachfit_valid_student_checkin_photo_path\(text\) from public/i)
  assert.match(migration, /grant execute on function private\.coachfit_valid_student_checkin_photo_path\(text\) to anon, authenticated/i)
  assert.match(migration, /to anon, authenticated[\s\S]*private\.coachfit_valid_student_checkin_photo_path\(storage\.objects\.name\)/i)
  assert.doesNotMatch(migration, /create policy[\s\S]*on public\.student_invites[\s\S]*to anon/i)
})

test('gerenciamento salva com o treinador autenticado e permissao minima', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const saveFlow = app.match(/async function saveCoachSettings\(settings\)[\s\S]*?\n  }/)?.[0] || ''
  const migration = await readFile(new URL('../SUPABASE/migrations/20260930183000_fix_coach_settings_management_rls.sql', import.meta.url), 'utf8').catch(() => '')

  assert.match(saveFlow, /coachId:\s*activeCoachId/)
  assert.match(saveFlow, /saveRemoteCoachSettings\(settings,\s*activeCoachId\)/)
  assert.match(migration, /alter table public\.coach_settings enable row level security/i)
  assert.match(migration, /grant select, insert, update on table public\.coach_settings to authenticated/i)
  assert.match(migration, /for insert[\s\S]*to authenticated[\s\S]*with check \(\(select auth\.uid\(\)\) = coach_id\)/i)
  assert.match(migration, /for update[\s\S]*to authenticated[\s\S]*using \(\(select auth\.uid\(\)\) = coach_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = coach_id\)/i)
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]* to anon/i)
})
