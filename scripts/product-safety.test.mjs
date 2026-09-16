import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('resposta de uma sessão encerrada não retorna dados para a próxima conta', async (t) => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  t.after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow })
  globalThis.window = { setTimeout, clearTimeout }
  const source = (await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8'))
    .replaceAll('import.meta.env.', '({VITE_SUPABASE_URL:"https://qa.invalid",VITE_SUPABASE_ANON_KEY:"qa-public-key"}).')
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
