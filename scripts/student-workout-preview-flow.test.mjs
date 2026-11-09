import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

const student = { id: 'build28-preview-student', name: 'Aluno de prévia', goal: 'Hipertrofia', level: 'Intermediário' }
const workout = { id: 'build28-preview-workout', title: 'Treino demonstrativo', days: [
  { day: 'Segunda-feira', focus: 'Peito', exercises: [{ name: 'Supino reto', sets: '3', reps: '10', rest: '60s' }, { name: 'Remada baixa', sets: '3', reps: '12', rest: '60s' }] },
  { day: 'Quarta-feira', focus: 'Costas', exercises: [{ name: 'Remada baixa', sets: '3', reps: '12', rest: '60s' }] },
] }
let server, StudentWorkoutExecution, appSource

before(async () => {
  server = await createServer({
    mode: 'test', envFile: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
    server: { middlewareMode: true, hmr: false },
  })
  const app = await server.ssrLoadModule('/src/App.jsx')
  StudentWorkoutExecution = app.StudentWorkoutExecution
  appSource = await (await import('node:fs/promises')).readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
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
  assert.match(html.execution, /Técnica do exercício/)
  assert.match(html.execution, /Registrar série e descansar/)
  assert.match(html.rest, /Recupere o fôlego/)
  assert.match(html.rest, /00:48/)
  assert.match(html['exercise-complete'], /feito\./)
  assert.match(html['exercise-complete'], /Seus registros/)
  assert.match(html['exercise-complete'], /Ir para Remada baixa/)
  assert.match(html.summary, /Resumo demonstrativo/)
  assert.match(html.summary, /Plano previsto/)
  assert.match(html.summary, /Resumo demonstrativo\. Os valores reais aparecem após o aluno concluir a sessão\./)
  assert.match(html.summary, /data-preview-rating="true"/)
  assert.match(html.summary, /<strong>—<\/strong>/)
})

test('prévia da Área do aluno não recebe callbacks reais', () => {
  const portal = appSource.match(/function StudentPortalPreview\([\s\S]*?(?=\nfunction [A-Z][A-Za-z0-9_]*)/)?.[0] || ''
  assert.match(portal, /workoutPreviewStage/)
  assert.match(portal, /previewStage=\{workoutPreviewStage\}/)
  assert.doesNotMatch(portal, /onCompleteWorkout\s*=|onEndWorkout\s*=|onRateWorkout\s*=|onSaveWorkoutSession\s*=/)
})
after(async () => { await server?.close() })
