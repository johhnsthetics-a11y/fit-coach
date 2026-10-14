import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Admin Master exposes a dedicated free-access workspace backed by protected RPCs', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const panel = await readFile(new URL('../src/AdminStudentFreeAccess.jsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(app, /Acessos gratuitos/)
  assert.match(app, /<AdminStudentFreeAccess\b/)
  assert.match(panel, /Liberações gratuitas/)
  assert.match(panel, /Aluno/)
  assert.match(panel, /Paciente/)
  assert.match(panel, /Revogar/)
  assert.match(panel, /loadRemoteStudentFreeAccessGrants/)
  assert.match(panel, /grantRemoteStudentFreeAccess/)
  assert.match(panel, /revokeRemoteStudentFreeAccess/)
  assert.match(api, /coachfit_list_student_free_access_grants/)
  assert.match(api, /coachfit_grant_student_free_access/)
  assert.match(api, /coachfit_revoke_student_free_access/)
})

test('student portal identifies the grant and presents both charges as exempt', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(api, /freeAccessGranted:\s*payload\.free_access_granted === true/)
  assert.match(app, /freeAccessGranted=\{access\.freeAccessGranted\}/)
  assert.match(app, /Acesso gratuito para testes/)
  assert.match(app, /Isento pelo Admin Master/)
  assert.match(app, /freeAccessGranted\s*\?\s*\[\]\s*:\s*visibleInvoices/)
})

