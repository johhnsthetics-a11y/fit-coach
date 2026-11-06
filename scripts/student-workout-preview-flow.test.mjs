import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

const student = { id: 'build28-preview-student', name: 'Aluno de prévia', goal: 'Hipertrofia', level: 'Intermediário' }
const workout = { id: 'build28-preview-workout', title: 'Treino demonstrativo', days: [
  { day: 'Segunda-feira', focus: 'Peito', exercises: [{ name: 'Supino reto', sets: '3', reps: '10', rest: '60s' }] },
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

test('prévia percorre quatro etapas sem inventar desempenho ou salvar dados reais', () => {
  const roots = { overview: /mobile-workout-overview-v24/, plan: /mobile-workout-plan-v24/, execution: /mobile-workout-execution-v24/, summary: /mobile-workout-summary-v24/ }
  const html = Object.fromEntries(Object.keys(roots).map(stage => [stage, renderToString(React.createElement(StudentWorkoutExecution, { student, workout, preview: true, previewStage: stage, dayIndex: 0 }))]))
  for (const [stage, root] of Object.entries(roots)) {
    assert.match(html[stage], new RegExp(`data-preview-screen="${stage}"`))
    assert.match(html[stage], root)
  }
  assert.match(html.overview, /Quarta-feira/)
  assert.match(html.plan, /Antes de começar/)
  assert.match(html.execution, /Concluir série/)
  assert.match(html.summary, /Resumo demonstrativo/)
  assert.match(html.summary, /Plano previsto:/)
  assert.match(html.summary, /Os indicadores reais aparecem após o aluno concluir a sessão\./)
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
