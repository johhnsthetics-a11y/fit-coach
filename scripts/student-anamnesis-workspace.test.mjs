import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../src/StudentAnamnesisWorkspace.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/StudentAnamnesisWorkspace.css', import.meta.url), 'utf8')
const appCss = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('Students exposes Carteira and Anamnese tabs without changing routes', () => {
  const students = app.slice(app.indexOf('function Students('), app.indexOf('function StudentRankingPanel('))
  assert.match(students, /Carteira/)
  assert.match(students, /Anamnese/)
  assert.match(students, /<StudentAnamnesisWorkspace/)
  assert.match(students, /hidden=\{studentSection !== 'anamnesis'\}/)
  assert.match(students, /hidden=\{studentSection !== 'wallet'\}/)
  assert.match(students, /student-wallet-workspace/)
  assert.match(students, /student-wallet-directory/)
  assert.match(students, /student-wallet-directory__list/)
  assert.doesNotMatch(students, /window\.history|URLSearchParams/)
})

test('inactive Students workspaces remain mounted but cannot leak into the active tab', () => {
  assert.match(appCss, /\.students-workspace\s*>\s*\[hidden\][\s\S]*?display:\s*none\s*!important/)
})

test('Students tabs expose complete keyboard and tabpanel semantics', () => {
  const students = app.slice(app.indexOf('function Students('), app.indexOf('function StudentRankingPanel('))
  assert.match(students, /onKeyDown=\{handleStudentTabsKeyDown\}/)
  assert.match(students, /id="students-tab-wallet"[\s\S]*?aria-controls="students-panel-wallet"/)
  assert.match(students, /id="students-tab-anamnesis"[\s\S]*?aria-controls="students-panel-anamnesis"/)
  assert.match(students, /id="students-panel-anamnesis"[\s\S]*?role="tabpanel"[\s\S]*?aria-labelledby="students-tab-anamnesis"/)
  assert.match(students, /id="students-panel-wallet"[\s\S]*?role="tabpanel"[\s\S]*?aria-labelledby="students-tab-wallet"/)
  assert.match(students, /ArrowLeft/)
  assert.match(students, /ArrowRight/)
})

test('Carteira uses a responsive master-detail flow and preserves the selected student', () => {
  const students = app.slice(app.indexOf('function Students('), app.indexOf('function StudentRankingPanel('))
  assert.match(students, /walletMobileView/)
  assert.match(students, /handleWalletStudentSelect/)
  assert.match(students, /data-mobile-view=\{walletMobileView\}/)
  assert.match(students, /student-wallet-mobile-back/)
  assert.match(students, /aria-current=\{selectedStudent\?\.id === student\.id \? 'true' : undefined\}/)
  assert.match(appCss, /student-wallet-columns[\s\S]*?grid-template-columns:\s*minmax\(320px,\s*380px\)\s+minmax\(0,\s*1fr\)/)
  assert.match(appCss, /@media \(max-width: 1279px\)[\s\S]*?data-mobile-view='detail'[\s\S]*?student-wallet-directory[\s\S]*?display:\s*none/)
  assert.match(appCss, /@media \(max-width: 1279px\)[\s\S]*?data-mobile-view='list'[\s\S]*?student-wallet-detail[\s\S]*?display:\s*none/)
})

test('Carteira exposes semantic progress, compact detail groups and protected destructive actions', () => {
  const students = app.slice(app.indexOf('function Students('), app.indexOf('function StudentRankingPanel('))
  const snapshot = app.slice(app.indexOf('function StudentSnapshot('), app.indexOf('function Row('))
  assert.match(students, /role="progressbar"/)
  assert.match(students, /aria-valuenow=\{clampPercent\(student\.adherence\)\}/)
  assert.match(students, /student-wallet-progress__fill/)
  assert.match(students, /student-wallet-detail-grid/)
  assert.match(students, /<StudentWalletDetailSection/)
  assert.match(app, /function StudentWalletDetailSection[\s\S]*?student-wallet-detail-section/)
  assert.match(students, /student-wallet-actions-menu/)
  assert.match(students, /<summary[^>]*>[\s\S]*?Mais opções/)
  assert.match(snapshot, /role="progressbar"/)
  assert.doesNotMatch(students, /<StudentPlanPreview/)
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

test('workspace presents a useful model library and separates settings from questions', () => {
  assert.match(workspace, /student-anamnesis-workspace__templates-heading/)
  assert.match(workspace, /student-anamnesis-empty-state/)
  assert.match(workspace, /Seu primeiro modelo está em edição/)
  assert.match(workspace, /student-anamnesis-editor__settings/)
  assert.match(workspace, /student-anamnesis-question-list-heading/)
  assert.match(workspace, /\{draft\.questions\.length\} perguntas/)
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
  assert.match(css, /@media \(max-width: 980px\)/)
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /\.student-anamnesis-workspace/)
  assert.match(css, /\.student-anamnesis-workspace\.theme-dark/)
  assert.match(css, /\.student-anamnesis-workspace\.theme-light/)
  assert.match(css, /--anamnesis-surface:/)
  assert.match(css, /\.student-anamnesis-editor[\s\S]*?background: var\(--anamnesis-surface\)/)
  assert.match(css, /\.student-anamnesis-question__required input[\s\S]*?width:\s*1\.1rem/)
  assert.match(css, /\.student-anamnesis-empty-state/)
  assert.match(css, /\.student-anamnesis-editor__settings/)
  assert.match(css, /\.student-anamnesis-question-list-heading/)
  assert.match(css, /\.student-anamnesis-workspace\.theme-light \.student-anamnesis-send[\s\S]*?background:\s*var\(--anamnesis-accent-strong\)[\s\S]*?color:\s*#ffffff/)
  assert.match(css, /\.app-theme-light/)
  assert.match(appCss, /\.student-wallet-directory[\s\S]*?position: sticky/)
  assert.match(appCss, /\.student-wallet-directory__list[\s\S]*?overflow-y: auto/)
  assert.match(appCss, /\.student-wallet-directory__list[\s\S]*?flex:\s*1 1 auto/)
  assert.match(appCss, /@media \(max-width: 1279px\)[\s\S]*?data-mobile-view='detail'/)
})
