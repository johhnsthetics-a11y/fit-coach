import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

const student = { id: 'build28-preview-student', name: 'Aluno de prévia', goal: 'Hipertrofia', level: 'Intermediário' }
const workout = { id: 'build28-preview-workout', title: 'Treino demonstrativo', days: [
  { day: 'Segunda-feira', focus: 'Peito', exercises: [{ name: 'Supino reto', sets: '3', reps: '10', rest: '60s' }, { name: 'Remada baixa', sets: '3', reps: '12', rest: '60s' }] },
  { day: 'Quarta-feira', focus: 'Costas', exercises: [{ name: 'Remada baixa', sets: '3', reps: '12', rest: '60s' }] },
] }
let server, StudentWorkoutExecution, appSource, figmaCss

before(async () => {
  server = await createServer({
    mode: 'test', envFile: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
    server: { middlewareMode: true, hmr: false },
  })
  const app = await server.ssrLoadModule('/src/App.jsx')
  StudentWorkoutExecution = app.StudentWorkoutExecution
  appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  figmaCss = await readFile(new URL('../src/student-workout-figma-dark.css', import.meta.url), 'utf8')
})

test('prévia percorre as cinco telas do Figma sem salvar dados reais', () => {
  const roots = {
    overview: /student-workout-figma-overview/,
    execution: /student-workout-figma-execution/,
    rest: /student-workout-figma-rest/,
    'exercise-complete': /student-workout-figma-exercise-complete/,
    summary: /student-workout-figma-summary/,
  }
  const html = Object.fromEntries(Object.keys(roots).map(stage => [stage, renderToString(React.createElement(StudentWorkoutExecution, { student, workout, preview: true, previewStage: stage, dayIndex: 0 }))]))
  for (const [stage, root] of Object.entries(roots)) {
    assert.match(html[stage], new RegExp(`data-preview-screen="${stage}"`))
    assert.match(html[stage], root)
  }
  assert.match(html.overview, /SEU TREINO/)
  assert.match(html.overview, /exercícios[\s\S]*séries[\s\S]*minutos/)
  assert.match(html.overview, /Iniciar treino/)
  assert.match(html.overview, /data-progress-segment/)
  assert.match(html.execution, /Técnica do exercício/)
  assert.match(html.execution, /Registrar série e descansar/)
  assert.match(html.execution, /data-progress-segment/)
  assert.match(html.rest, /Recupere o fôlego/)
  assert.match(html.rest, /00:48/)
  assert.match(html['exercise-complete'], /feito\./)
  assert.match(html['exercise-complete'], /Seus registros/)
  assert.match(html['exercise-complete'], /Conclua uma série nesta prévia para exibir seus registros reais/)
  assert.doesNotMatch(html['exercise-complete'], /Exemplo demonstrativo/)
  assert.doesNotMatch(html['exercise-complete'], /class="student-workout-figma-set-record"/)
  assert.match(html['exercise-complete'], /Ir para Remada baixa/)
  assert.match(html.summary, /Resumo demonstrativo/)
  assert.match(html.summary, /Plano previsto/)
  assert.match(html.summary, /Resumo demonstrativo\. Os valores reais aparecem após o aluno concluir a sessão\./)
  assert.match(html.summary, /data-preview-rating="true"/)
  assert.match(html.summary, /<strong>—<\/strong>/)
})

test('cabeçalhos do aluno não repetem o mesmo nome de plano e dia', () => {
  const samePlanAndDay = { ...workout, title: 'Treino A', days: [{ ...workout.days[0], day: 'Treino A' }] }
  for (const stage of ['overview', 'execution', 'rest', 'exercise-complete', 'summary']) {
    const html = renderToString(React.createElement(StudentWorkoutExecution, { student, workout: samePlanAndDay, preview: true, previewStage: stage, dayIndex: 0 }))
    assert.doesNotMatch(html, /Treino A\s*[—•]\s*Treino A/)
  }
  const distinctTitles = { ...workout, title: 'Plano principal', days: [{ ...workout.days[0], day: 'Treino A' }] }
  const distinctHtml = renderToString(React.createElement(StudentWorkoutExecution, { student, workout: distinctTitles, preview: true, previewStage: 'overview', dayIndex: 0 }))
  assert.match(distinctHtml, /Plano principal — Treino A/)
})

test('a prévia usa os tokens oficiais escuros e o fluxo permanece somente local', () => {
  assert.match(figmaCss, /--sw-bg:\s*#0B1516/)
  assert.match(figmaCss, /--sw-panel:\s*#111E20/)
  assert.match(figmaCss, /--sw-text:\s*#F4FFFD/)
  assert.match(figmaCss, /--sw-muted:\s*#A7BDBA/)
  assert.match(figmaCss, /--sw-accent:\s*#4EE9D0/)
  assert.match(figmaCss, /\.student-mobile-shell\s+\.mobile-workout-student-experience-v2:not\(\.is-compact\)\.student-workout-figma-screen\s*\{\s*background:\s*var\(--sw-bg\)\s*!important;/)
  assert.match(figmaCss, /--sw-bg:\s*#FFFFFF/)
  assert.match(figmaCss, /--sw-accent:\s*#087F72/)
  assert.match(figmaCss, /html body \.student-mobile-shell\.app-theme-light[\s\S]{0,260}student-workout-figma-primary/)
  assert.match(figmaCss, /student-workout-figma-progress-segments/)
  assert.match(appSource, /function returnFromRestToExecution\(\)/)
  assert.match(appSource, /if \(preview\) onPreviewStageChange\?\.\('execution'\)/)
  assert.match(appSource, /if \(preview\) onPreviewStageChange\?\.\(nextPendingAfterCompletion/)
  assert.match(appSource, /if \(preview \|\| !student\?\.id \|\| !workout\?\.id\) return/)
})

test('prévia da Área do aluno não recebe callbacks reais', () => {
  const portal = appSource.match(/function StudentPortalPreview\([\s\S]*?(?=\nfunction [A-Z][A-Za-z0-9_]*)/)?.[0] || ''
  assert.match(portal, /workoutPreviewStage/)
  assert.match(portal, /previewStage=\{workoutPreviewStage\}/)
  assert.doesNotMatch(portal, /onCompleteWorkout\s*=|onEndWorkout\s*=|onRateWorkout\s*=|onSaveWorkoutSession\s*=/)
})
after(async () => { await server?.close() })
