import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
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
let getExercisePickerResults
let getStudentWorkoutExercises
const originalWindow = globalThis.window

before(async () => {
  // Keep the test local even when the developer has Supabase env variables.
  server = await createServer({
    mode: 'test', envFile: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
    server: { middlewareMode: true, hmr: false },
  })
  ;({ default: App, getExercisePickerResults, getStudentWorkoutExercises } = await server.ssrLoadModule('/src/App.jsx'))
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

test('Treinos mostra filtros com capitalização profissional sem alterar os valores internos', () => {
  const storage = new Map([['fitcoach-ai-pro-v2', JSON.stringify({
    user: { id: 'coach-labels', name: 'Treinador de rótulos' },
    students: [student],
    workouts: [workout],
  })]])
  globalThis.window = {
    localStorage: { getItem: (key) => storage.get(key) ?? null },
    location: new URL('http://localhost/?area=treinos'),
  }
  const html = renderToString(React.createElement(App))
  for (const label of ['Todos', 'Hipertrofia', 'Emagrecimento', 'Força', 'Publicado']) {
    assert.match(html, new RegExp(`>${label}<`))
  }
})

test('biblioteca de exercícios mantém todos os resultados e o filtro de favoritos', () => {
  const library = Array.from({ length: 65 }, (_, index) => ({
    name: `Exercício ${index + 1}`,
    group: index % 2 ? 'Peito' : 'Costas',
    equipment: 'Halteres',
  }))

  const allResults = getExercisePickerResults({ library })
  const favoriteResults = getExercisePickerResults({
    library,
    tab: 'favorites',
    favorites: ['Exercício 2', 'Exercício 64'],
  })

  assert.equal(allResults.length, 65)
  assert.deepEqual(favoriteResults.map((exercise) => exercise.name), ['Exercício 2', 'Exercício 64'])
})

test('filtro Peitoral encontra exercícios cadastrados como Peito', () => {
  const results = getExercisePickerResults({
    library: [
      { name: 'Supino reto com barra', group: 'Peito', equipment: 'Barra' },
      { name: 'Remada baixa', group: 'Costas', equipment: 'Cabos' },
    ],
    muscleFilter: 'Peitoral',
  })

  assert.deepEqual(results.map((exercise) => exercise.name), ['Supino reto com barra'])
})

test('visão do aluno exibe exercícios de todos os dias da rotina', () => {
  const exercises = getStudentWorkoutExercises({
    title: 'Treino ABC',
    days: [
      { day: 'Segunda-feira', exercises: [{ name: 'Supino reto', sets: '4', reps: '10' }] },
      { day: 'Quarta-feira', exercises: [{ name: 'Remada baixa', sets: '3', reps: '12' }] },
    ],
  }, [])

  assert.deepEqual(exercises.map((exercise) => exercise.name), ['Supino reto', 'Remada baixa'])
  assert.deepEqual(exercises.map((exercise) => exercise.day), ['Segunda-feira', 'Quarta-feira'])
})

test('prévia local não é controlada pelo cache do service worker de produção', async () => {
  const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  const workerSource = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8')

  assert.match(mainSource, /import\.meta\.env\.PROD/)
  assert.match(mainSource, /getRegistrations\(\)/)
  assert.match(workerSource, /url\.pathname\.startsWith\('\/src\/'\)/)
})
