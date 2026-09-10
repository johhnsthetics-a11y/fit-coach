import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

// Render the actual route and all its children. A source-string check/build
// cannot detect undeclared identifiers evaluated only when students exist.
const student = { id: 'student-regression', name: 'Aluno Regressão', goal: 'Hipertrofia', level: 'Intermediário' }
const workout = {
  id: 'workout-regression', studentId: student.id, title: 'Rotina Regressão',
  active: true, exercises: [{ name: 'Supino reto com barra', sets: '3', reps: '10', rest: '60s' }],
}
let server
let App
const originalWindow = globalThis.window

before(async () => {
  // Keep the test local even when the developer has Supabase env variables.
  server = await createServer({
    mode: 'test', envFile: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
    server: { middlewareMode: true, hmr: false },
  })
  ;({ default: App } = await server.ssrLoadModule('/src/App.jsx'))
})

after(async () => {
  await server?.close()
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})

for (const scenario of [
  { name: 'aluno cadastrado sem treinos', students: [student], workouts: [] },
  { name: 'aluno cadastrado com treino', students: [student], workouts: [workout] },
  { name: 'conta nova sem alunos', students: [], workouts: [] },
  { name: 'treino legado com exercícios nulos', students: [student], workouts: [{ ...workout, exercises: null }] },
]) {
  test(`Treinos renderiza: ${scenario.name}`, () => {
    const storage = new Map([['fitcoach-ai-pro-v2', JSON.stringify({
      user: { id: 'coach-regression', name: 'Treinador Regressão' },
      students: scenario.students, workouts: scenario.workouts,
    })]])
    globalThis.window = {
      localStorage: { getItem: (key) => storage.get(key) ?? null },
      location: new URL('http://localhost/?area=treinos'),
    }
    const html = renderToString(React.createElement(App))
    assert.match(html, /mobile-workout-manager/)
    assert.doesNotMatch(html, /Algo saiu do lugar/)
    if (scenario.students.length) {
      assert.match(html, /Nome do treino/)
      assert.match(html, /<option value="student-regression" selected="">Aluno Regressão<\/option>/)
    }
    if (scenario.workouts.length) assert.match(html, /Rotina Regressão/)
  })
}
