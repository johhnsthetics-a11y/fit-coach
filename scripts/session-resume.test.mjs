import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { shouldRefreshPersistedSession } from '../src/authSession.js'

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

test('renova imediatamente uma sessao persistida vencida ou perto do vencimento', () => {
  const now = Date.parse('2026-10-02T12:00:00Z')

  assert.equal(shouldRefreshPersistedSession({
    access_token: 'access',
    refresh_token: 'refresh',
    expires_at: (now - 1_000) / 1_000,
  }, now), true)
  assert.equal(shouldRefreshPersistedSession({
    access_token: 'access',
    refresh_token: 'refresh',
    expires_at: (now + 30_000) / 1_000,
  }, now), true)
  assert.equal(shouldRefreshPersistedSession({
    access_token: 'access',
    refresh_token: 'refresh',
    expires_at: (now + 5 * 60_000) / 1_000,
  }, now), false)
})

test('nao tenta renovar sem refresh token e recupera sessoes legadas incompletas', () => {
  assert.equal(shouldRefreshPersistedSession({ access_token: 'access' }), false)
  assert.equal(shouldRefreshPersistedSession({ access_token: 'access', refresh_token: 'refresh' }), true)
  assert.equal(shouldRefreshPersistedSession(null), false)
})

test('bootstrap aguarda a restauracao antes de carregar os portais', () => {
  assert.match(appSource, /shouldRefreshPersistedSession/)
  assert.match(appSource, /sessionRestoring/)
  assert.match(appSource, /if \(sessionRestoring\) return <AppLoading \/>/)
})

test('carteira profissional nao renderiza vazia antes da hidratacao remota', () => {
  assert.match(appSource, /const \[professionalWorkspaceLoading, setProfessionalWorkspaceLoading\] = useState/)
  assert.match(appSource, /setProfessionalWorkspaceLoading\(true\)[\s\S]*?loadRemoteData\(data\.session\.user\.id\)/)
  assert.match(appSource, /if \(professionalWorkspaceLoading && data\.session\?\.access_token && data\.session\?\.user\?\.accountType !== 'student'\) return <AppLoading \/>/)
})

test('cabecalho de vendas respeita safe area e mantem Entrar visivel no mobile', () => {
  assert.match(appSource, /sales-header-login-button/)
  assert.match(cssSource, /\.sales-page \.sales-header\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top/s)
  assert.match(cssSource, /\.sales-header-login-button\s*\{[^}]*min-height:\s*44px/s)
  assert.match(cssSource, /@media \(max-width:\s*380px\)[\s\S]*?\.sales-header-logo-link \.fit-brand-lockup/)
})
