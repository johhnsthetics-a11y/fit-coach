import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  ADMIN_SETTINGS_REFRESH_INTERVAL_MS,
  STUDENT_PORTAL_REFRESH_INTERVAL_MS,
  readLocalStorage,
  removeLocalStorage,
  shouldRunVisibleRefresh,
  writeLocalStorage,
} from '../src/studentPortalRuntime.js'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

test('portal continua utilizavel quando o navegador bloqueia o armazenamento local', () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    get localStorage() {
      throw new DOMException('Storage blocked', 'SecurityError')
    },
  }

  try {
    assert.equal(readLocalStorage('student', 'fallback'), 'fallback')
    assert.equal(writeLocalStorage('student', 'value'), false)
    assert.equal(removeLocalStorage('student'), false)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

test('sincronizacao visivel evita sobreposicao e rajadas de requisicoes', () => {
  assert.equal(ADMIN_SETTINGS_REFRESH_INTERVAL_MS, 5 * 60 * 1000)
  assert.equal(STUDENT_PORTAL_REFRESH_INTERVAL_MS, 20 * 1000)
  assert.equal(shouldRunVisibleRefresh({ visibilityState: 'hidden' }), false)
  assert.equal(shouldRunVisibleRefresh({ pending: true }), false)
  assert.equal(shouldRunVisibleRefresh({ lastStartedAt: 9_000, now: 10_000, minimumGapMs: 2_000 }), false)
  assert.equal(shouldRunVisibleRefresh({ lastStartedAt: 7_000, now: 10_000, minimumGapMs: 2_000 }), true)
})

test('area do aluno usa persistencia resiliente e sincronizacao economica', () => {
  assert.match(app, /readLocalStorage\(STUDENT_ACCESS_KEY/)
  assert.match(app, /removeLocalStorage\(STUDENT_ACCESS_KEY\)/)
  assert.match(app, /STUDENT_PORTAL_REFRESH_INTERVAL_MS/)
  assert.match(app, /ADMIN_SETTINGS_REFRESH_INTERVAL_MS/)
  assert.match(api, /const revision = sessionRevision[\s\S]*?assertCurrentSession\(revision\)/)
})

test('check-in nao preenche dados ficticios nem aceita envio vazio', () => {
  const checkin = app.slice(app.indexOf('function CheckinForm('), app.indexOf('function CoachSubscription('))
  assert.doesNotMatch(checkin, /defaultValue="84,0 kg"|defaultValue="Registrar avaliação do coach\."/)
  assert.match(checkin, /Informe o peso, uma observação ou uma foto antes de salvar/)
  assert.match(checkin, /placeholder="Ex.: 84,0 kg"/)
})
