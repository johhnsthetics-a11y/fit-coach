import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { isPermanentRefreshError } from '../src/authSession.js'

test('only an explicit rejected refresh invalidates the saved session', () => {
  assert.equal(isPermanentRefreshError({ status: 400 }), true)
  assert.equal(isPermanentRefreshError({ status: 401 }), true)
  assert.equal(isPermanentRefreshError({ status: 403 }), true)
  for (const error of [{ status: 429 }, { status: 503 }, new TypeError('Failed to fetch'), new Error('timeout')]) {
    assert.equal(isPermanentRefreshError(error), false)
  }
})

test('concurrent refresh calls share one request and rotate the token once', async (t) => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  t.after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow })
  globalThis.window = { setTimeout, clearTimeout }
  const referralSource = await readFile(new URL('../src/professionalReferral.js', import.meta.url), 'utf8')
  const referralModuleUrl = 'data:text/javascript;base64,' + Buffer.from(referralSource).toString('base64')
  const protocolTasksSource = await readFile(new URL('../src/protocolTasks.js', import.meta.url), 'utf8')
  const protocolTasksModuleUrl = 'data:text/javascript;base64,' + Buffer.from(protocolTasksSource).toString('base64')
  const firstPasswordModuleUrl = new URL('../src/studentFirstPassword.js', import.meta.url).href
  const source = (await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8'))
    .replaceAll('import.meta.env.', '({VITE_SUPABASE_URL:"https://qa.invalid",VITE_SUPABASE_ANON_KEY:"qa-public-key"}).')
    .replace("'./professionalReferral'", `'${referralModuleUrl}'`)
    .replace("'./protocolTasks'", `'${protocolTasksModuleUrl}'`)
    .replace("'./studentFirstPassword'", `'${firstPasswordModuleUrl}'`)
  const api = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
  let calls = 0
  let respond
  globalThis.fetch = () => { calls += 1; return new Promise((resolve) => { respond = resolve }) }
  const first = api.refreshCoachSession('refresh-a')
  const second = api.refreshCoachSession('refresh-a')
  assert.equal(calls, 1)
  respond(new Response(JSON.stringify({ access_token: 'access-b', refresh_token: 'refresh-b', expires_in: 3600, user: { id: 'user-a' } }), { status: 200 }))
  const results = await Promise.all([first, second])
  assert.deepEqual(results[0], results[1])
  assert.equal(results[0].refresh_token, 'refresh-b')
  assert.equal((await api.refreshCoachSession('refresh-a')).refresh_token, 'refresh-b')
  assert.equal(calls, 1)

  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ message: 'Invalid Refresh Token' }), { status: 401 }))
  api.setSupabaseSession('access-new-account')
  await assert.rejects(api.refreshCoachSession('refresh-a'), (error) => error.status === 401)
  await assert.rejects(api.refreshCoachSession('refresh-invalid'), (error) => error.status === 401)

  globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'))
  await assert.rejects(api.refreshCoachSession('refresh-retry'), /conectar ao servidor/)
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ access_token: 'access-c', refresh_token: 'refresh-c', user: { id: 'user-a' } }), { status: 200 }))
  assert.equal((await api.refreshCoachSession('refresh-retry')).refresh_token, 'refresh-c')
})

test('persistent crash report contains no raw exception or component stack', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const handler = source.match(/componentDidCatch\([^)]*\) \{[\s\S]*?\n  \}/)?.[0] || ''
  assert.doesNotMatch(handler, /error\?\.message|error\?\.stack|info\?\.componentStack/)
  assert.match(handler, /Erro inesperado/)
})
