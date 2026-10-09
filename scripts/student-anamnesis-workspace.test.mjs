import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../src/StudentAnamnesisWorkspace.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/StudentAnamnesisWorkspace.css', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('Students exposes Carteira and Anamnese tabs without changing routes', () => {
  const students = app.slice(app.indexOf('function Students('), app.indexOf('function StudentRankingPanel('))
  assert.match(students, /Carteira/)
  assert.match(students, /Anamnese/)
  assert.match(students, /<StudentAnamnesisWorkspace/)
  assert.match(students, /hidden=\{studentSection !== 'anamnesis'\}/)
  assert.doesNotMatch(students, /window\.history|URLSearchParams/)
})

test('workspace isolates anamnesis templates and supports complete question editing', () => {
  assert.match(workspace, /questionnaireType === QUESTIONNAIRE_TYPES\.ANAMNESIS/)
  assert.match(workspace, /questionSnapshot\?\.questionnaireType === QUESTIONNAIRE_TYPES\.ANAMNESIS/)
  assert.match(workspace, /Adicionar pergunta/)
  assert.match(workspace, /Remover pergunta/)
  assert.match(workspace, /Mover pergunta para cima/)
  assert.match(workspace, /Mover pergunta para baixo/)
  assert.match(workspace, /Obrigatória/)
  assert.match(workspace, /Opções separadas por vírgula/)
})

test('delivery requires a student and offers immediate or scheduled priority without blocking access', () => {
  assert.match(workspace, /value="now"/)
  assert.match(workspace, /value="scheduled"/)
  assert.match(workspace, /scheduledFor/)
  assert.match(workspace, /priorityRequired/)
  assert.match(workspace, /não bloqueia o acesso às outras ferramentas/i)
  assert.match(workspace, /Selecione \$\{nutritionist \? 'uma pessoa' : 'um aluno'\}/)
  assert.match(workspace, /scheduledDate <= new Date\(\)/)
})

test('history renders scheduled, pending and completed states with role-aware audience copy', () => {
  assert.match(workspace, /Agendada/)
  assert.match(workspace, /Aguardando resposta/)
  assert.match(workspace, /Respondida/)
  assert.match(workspace, /nutritionist \? 'paciente' : 'aluno'/)
  assert.match(workspace, /nutritionist \? 'Pacientes' : 'Alunos'/)
})

test('workspace styles are responsive and loaded by the application', () => {
  assert.match(main, /StudentAnamnesisWorkspace\.css/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /\.student-anamnesis-workspace/)
  assert.match(css, /\.app-theme-light/)
})
