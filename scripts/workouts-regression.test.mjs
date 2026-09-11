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
let getExerciseLibrary
let getExercisePickerResults
let getStudentWorkoutExercises
let buildWorkoutStudentPreviewState
let WorkoutStudentLivePreview
let StudentWorkoutExecution
let getExerciseFallbackImage
let buildWorkoutCompletionPayload
let buildWorkoutExecutionSummary
let getStudentWorkoutExecutionStorageKey
const originalWindow = globalThis.window

before(async () => {
  // Keep the test local even when the developer has Supabase env variables.
  server = await createServer({
    mode: 'test', envFile: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
    server: { middlewareMode: true, hmr: false },
  })
  ;({ default: App, getExerciseLibrary, getExercisePickerResults, getStudentWorkoutExercises, buildWorkoutStudentPreviewState, WorkoutStudentLivePreview, StudentWorkoutExecution, getExerciseFallbackImage, buildWorkoutCompletionPayload, buildWorkoutExecutionSummary, getStudentWorkoutExecutionStorageKey } = await server.ssrLoadModule('/src/App.jsx'))
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

test('biblioteca real continua disponível quando a API retorna uma lista vazia', () => {
  const library = getExerciseLibrary([])
  const results = getExercisePickerResults({ library })

  assert.ok(library.length >= 300)
  assert.equal(results.length, library.length)
  assert.ok(results.some((exercise) => exercise.name === 'Supino reto com barra'))
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

test('filtro Treino em Casa encontra exercícios compatíveis da biblioteca', () => {
  const results = getExercisePickerResults({
    library: [
      { name: 'Flexão de braços', group: 'Peitoral', equipment: 'Peso corporal' },
      { name: 'Remada com elástico', group: 'Costas', equipment: 'Elástico' },
      { name: 'Leg press 45°', group: 'Quadríceps', equipment: 'Máquina' },
    ],
    categoryFilter: 'Treino em Casa',
  })

  assert.deepEqual(results.map((exercise) => exercise.name), ['Flexão de braços', 'Remada com elástico'])
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

test('prévia fiel do aluno inicia no exercício ativo com séries registráveis', () => {
  const preview = buildWorkoutStudentPreviewState({
    title: 'Treino A',
    days: [{
      day: 'Segunda-feira',
      focus: 'Peito e tríceps',
      exercises: [{ name: 'Supino reto', sets: '4', reps: '8-12', load: '60 kg', rest: '90s' }],
    }],
  }, 0, 0)

  assert.equal(preview.title, 'Treino A')
  assert.equal(preview.dayLabel, 'Segunda-feira')
  assert.equal(preview.focus, 'Peito e tríceps')
  assert.equal(preview.exercise.name, 'Supino reto')
  assert.equal(preview.exercisePosition, 1)
  assert.equal(preview.totalExercises, 1)
  assert.deepEqual(preview.sets, [
    { number: 1, completed: false },
    { number: 2, completed: false },
    { number: 3, completed: false },
    { number: 4, completed: false },
  ])
})

test('prévia ao vivo renderiza a experiência interativa do aluno', () => {
  const html = renderToString(React.createElement(WorkoutStudentLivePreview, {
    student,
    workout: {
      title: 'Treino A',
      days: [{
        day: 'Segunda-feira',
        focus: 'Peito e tríceps',
        exercises: [{ name: 'Supino reto', sets: '4', reps: '8-12', load: '60 kg', rest: '90s' }],
      }],
    },
    dayIndex: 0,
  }))

  assert.match(html, /Visão do aluno/)
  assert.match(html, /Prévia ao vivo/)
  assert.match(html, /Supino reto/)
  assert.match(html, /Concluir série/)
  assert.match(html, /Carga \(kg\)/)
  assert.match(html, /Repetições/)
})

test('treinador e aluno compartilham a experiência completa de execução', () => {
  const html = renderToString(React.createElement(StudentWorkoutExecution, {
    student,
    preview: true,
    dayIndex: 0,
    workout: {
      title: 'Treino A',
      days: [{
        day: 'Segunda-feira',
        focus: 'Peito e tríceps',
        exercises: [{ name: 'Supino reto com barra', sets: '3', reps: '10', rest: '60s' }],
      }],
    },
  }))

  assert.match(html, /mobile-workout-student-experience-v2/)
  assert.match(html, /Concluir série/)
  assert.match(html, /Finalizar treino/)
  assert.match(html, /\+80 XP/)
  assert.match(html, /\/assets\/exercises\/coachfit-upper-push\.png/)
})

test('visão do aluno do treino publicado reutiliza o executor interativo fiel', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const componentSource = appSource.match(/function MobileWorkoutStudentPreview[\s\S]*?\r?\n}\r?\n\r?\nfunction summarizeWorkoutFocus/)?.[0] || ''

  assert.match(componentSource, /<StudentWorkoutExecution student=\{student\} workout=\{workout\} preview/)
  assert.doesNotMatch(componentSource, /mobile-workout-student-preview-days/)
})

test('biblioteca usa imagens profissionais coerentes por padrão de movimento', () => {
  assert.equal(getExerciseFallbackImage({ name: 'Agachamento livre', group: 'Quadríceps e glúteos' }), '/assets/exercises/coachfit-lower-body.png')
  assert.equal(getExerciseFallbackImage({ name: 'Supino reto com barra', group: 'Peitoral' }), '/assets/exercises/coachfit-upper-push.png')
  assert.equal(getExerciseFallbackImage({ name: 'Remada baixa', group: 'Costas' }), '/assets/exercises/coachfit-upper-pull.png')
  assert.equal(getExerciseFallbackImage({ name: 'Prancha abdominal', group: 'Core' }), '/assets/exercises/coachfit-core.png')
})

test('conclusão preserva séries, cargas e repetições no histórico do aluno', () => {
  const payload = buildWorkoutCompletionPayload({
    student,
    workout: { id: 'workout-a', coachId: 'coach-a', title: 'Treino A' },
    effort: 'Forte',
    durationSeconds: 1540,
    exerciseEntries: [{
      exercise: { name: 'Supino reto com barra' },
      sets: [{ number: 1, completed: true, load: '40', reps: '10' }, { number: 2, completed: true, load: '42', reps: '8' }],
    }],
  })

  assert.equal(payload.studentId, student.id)
  assert.equal(payload.workoutId, 'workout-a')
  assert.equal(payload.effort, 'Forte')
  assert.equal(payload.durationSeconds, 1540)
  assert.match(payload.notes, /Supino reto com barra/)
  assert.match(payload.notes, /S1: 40 kg × 10/)
  assert.match(payload.notes, /S2: 42 kg × 8/)
})

test('progresso da execução considera todos os dias antes de liberar a conclusão', () => {
  const multiDayWorkout = {
    title: 'Treino completo',
    days: [
      { day: 'Dia 1', exercises: [{ name: 'Supino reto', sets: '2' }] },
      { day: 'Dia 2', exercises: [{ name: 'Remada baixa', sets: '3' }] },
    ],
  }
  const summary = buildWorkoutExecutionSummary(multiDayWorkout, {
    '0-0-1': { completed: true },
    '0-0-2': { completed: true },
  }, [])

  assert.equal(summary.totalSets, 5)
  assert.equal(summary.completedSets, 2)
  assert.equal(summary.canFinish, false)
})

test('rascunho de execução fica isolado por aluno e treino', () => {
  assert.equal(
    getStudentWorkoutExecutionStorageKey('student-a', 'workout-a'),
    'coachfitpro-workout-execution-v1:student-a:workout-a',
  )
  assert.notEqual(
    getStudentWorkoutExecutionStorageKey('student-a', 'workout-a'),
    getStudentWorkoutExecutionStorageKey('student-b', 'workout-a'),
  )
})

test('publicação exige seleção explícita e edição preserva o aluno associado', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const managerSource = appSource.match(/function MobileWorkoutManager[\s\S]*?\r?\n}\r?\n\r?\nfunction createExerciseDraft/)?.[0] || ''

  assert.match(managerSource, /name="studentId"/)
  assert.match(managerSource, /Selecione o aluno/)
  assert.match(managerSource, /isEditingExistingWorkout \? workout\?\.studentId/)
  assert.match(managerSource, /if \(targetStudentId\) setSelectedStudentId\(targetStudentId\)/)
  assert.match(managerSource, /resetDraftFromWorkout\(null,\s*\{\s*studentId:\s*student\.id\s*\}\)/)
  assert.doesNotMatch(managerSource, /const studentId = selectedStudentId \|\| selectedStudent\?\.id \|\| students\[0\]\?\.id/)
})

test('prévia local não é controlada pelo cache do service worker de produção', async () => {
  const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  const workerSource = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8')

  assert.match(mainSource, /import\.meta\.env\.PROD/)
  assert.match(mainSource, /getRegistrations\(\)/)
  assert.match(workerSource, /url\.pathname\.startsWith\('\/src\/'\)/)
})

test('publicação de treino usa RPC transacional protegida por ownership', async () => {
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const migrationSource = await readFile(new URL('../supabase/migrations/20260911_secure_workout_publish.sql', import.meta.url), 'utf8')

  assert.match(apiSource, /rpcRequest\('save_coach_workout'/)
  assert.match(apiSource, /request_id:\s*workout\.clientRequestId/)
  assert.match(migrationSource, /create or replace function public\.save_coach_workout/i)
  assert.match(migrationSource, /auth\.uid\(\)/i)
  assert.match(migrationSource, /jsonb_populate_record\(\s*null::public\.workout_exercises/i)
  assert.match(migrationSource, /from public\.students[\s\S]*coach_id = v_coach_id/i)
  assert.match(migrationSource, /delete from public\.workout_exercises[\s\S]*insert into public\.workout_exercises/i)
  assert.match(migrationSource, /pg_advisory_xact_lock[\s\S]*coachfitpro-publish/i)
  assert.match(migrationSource, /grant execute on function public\.save_coach_workout\(jsonb\) to authenticated/i)
  assert.doesNotMatch(migrationSource, /grant (all|insert|update|delete)[^;]* to anon/i)
})

test('conclusão do aluno usa token idempotente e RPC validada pelo vínculo do convite', async () => {
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const migrationSource = await readFile(new URL('../supabase/migrations/20260911_secure_workout_publish.sql', import.meta.url), 'utf8')

  assert.match(apiSource, /rpcRequest\('submit_student_workout_log_once'/)
  assert.match(apiSource, /completion_token: log\.completionToken/)
  assert.match(migrationSource, /create or replace function public\.submit_student_workout_log_once/i)
  assert.match(migrationSource, /from public\.student_invites/i)
  assert.match(migrationSource, /from public\.students[\s\S]*students\.coach_id = v_coach_id/i)
  assert.match(migrationSource, /student_id = v_student_id[\s\S]*coach_id = v_coach_id/i)
  assert.match(migrationSource, /pg_advisory_xact_lock/i)
  assert.match(migrationSource, /grant execute on function public\.submit_student_workout_log_once/i)
})

test('falha de rede mantém a execução pendente para retry sem conceder XP local', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const completeWorkoutSource = appSource.match(/async function completeWorkout\(log\)[\s\S]*?\r?\n  }\r?\n\r?\n  async function saveAppointment/)?.[0] || ''

  assert.doesNotMatch(completeWorkoutSource, /syncStatus:\s*'pending'/)
  assert.match(completeWorkoutSource, /throw error/)
})

test('políticas de alunos restringem todas as operações ao treinador autenticado', async () => {
  const migrationSource = await readFile(new URL('../supabase/migrations/20260911_secure_workout_publish.sql', import.meta.url), 'utf8')

  assert.match(migrationSource, /alter table public\.students enable row level security/i)
  assert.match(migrationSource, /on public\.students as restrictive[\s\S]*for select[\s\S]*coach_id = auth\.uid\(\)/i)
  assert.match(migrationSource, /on public\.students for insert[\s\S]*with check \(coach_id = auth\.uid\(\)\)/i)
  assert.match(migrationSource, /on public\.students for update[\s\S]*using \(coach_id = auth\.uid\(\)\)[\s\S]*with check \(coach_id = auth\.uid\(\)\)/i)
  assert.match(migrationSource, /on public\.students for delete[\s\S]*using \(coach_id = auth\.uid\(\)\)/i)
})

test('prévia compacta organiza dias sem rolagem horizontal', async () => {
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(cssSource, /workout-live-preview-responsive-v3/)
  assert.match(cssSource, /\.is-compact \.mobile-workout-student-day-tabs-v2\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[\s\S]*overflow:\s*visible/)
  assert.match(cssSource, /\.is-compact \.mobile-workout-student-day-tabs-v2 button\s*\{[\s\S]*min-width:\s*0/)
})

test('mapa muscular usa silhueta humana orgânica e mantém regiões interativas', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /muscle-map-human-anatomy-v3/)
  assert.match(appSource, /className="muscle-map-body-skin"/)
  assert.match(appSource, /className="muscle-map-body-contour"/)
  assert.match(appSource, /className:\s*`muscle-map-region/)
  assert.match(appSource, /compact \? 'h-52' : 'h-64'/)
  assert.doesNotMatch(appSource, /M39 24h22l7 28-6 29H38l-6-29 7-28Z/)
})
