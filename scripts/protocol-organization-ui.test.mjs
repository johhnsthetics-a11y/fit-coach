import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const componentPath = new URL('../src/OrganizationProtocols.jsx', import.meta.url)
const appPath = new URL('../src/App.jsx', import.meta.url)
const cssPath = new URL('../src/OrganizationProtocols.css', import.meta.url)

test('protocol planner loads remote tasks on entry and exposes planning, status, filtering, and print actions', () => {
  const source = readFileSync(componentPath, 'utf8')
  for (const api of ['loadRemoteProtocolTasks', 'saveRemoteProtocolTask', 'deleteRemoteProtocolTask', 'buildProtocolTasksPrintHtml']) {
    assert.ok(source.includes(api), `planner should use ${api}`)
  }
  for (const action of ['Organização de Protocolos', 'Nova tarefa', 'Semana', 'Dia', 'Concluir', 'Reabrir', 'Imprimir / salvar em PDF', 'protocol-day-group__heading']) {
    assert.ok(source.includes(action), `planner should show ${action}`)
  }
  assert.match(source, /catch\s*\(\w+\)/)
  assert.match(source, /setTasks\(/)
})

test('Agenda preserves the appointment flow and passes coach identity, profile and theme to the planner', () => {
  const source = readFileSync(appPath, 'utf8')
  assert.match(source, /<OrganizationProtocols\b/)
  assert.match(source, /coachId=\{data\.user\?\.id\}/)
  assert.match(source, /professionalType=\{nutritionistUser \? 'nutritionist' : 'trainer'\}/)
  assert.match(source, /appointments=\{data\.appointments/)
  assert.match(source, /Compromissos/)
})

test('planner adapts to narrow screens and light/dark application themes', () => {
  const source = readFileSync(cssPath, 'utf8')
  assert.match(source, /@media\s*\(max-width:\s*640px\)/)
  assert.match(source, /app-theme-light/)
  assert.match(source, /prefers-reduced-motion/)
})
