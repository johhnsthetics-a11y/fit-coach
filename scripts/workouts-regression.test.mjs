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
let filterMobileWorkouts
let sortWorkoutsByUpdatedAt
let getStudentWorkoutExercises
let buildWorkoutStudentPreviewState
let StudentWorkoutExecution
let StudentMobileApp
let TrainerExerciseLibrary
let getExerciseLibrarySyncCopy
let getExerciseFallbackImage
let buildWorkoutCompletionPayload
let buildWorkoutExecutionSummary
let getStudentWorkoutExecutionStorageKey
let buildStudentRewardStats
let buildCoachStudentRanking
let buildStudentWeekProgress
let reconcileMessageDelivery
let buildStudentExerciseProgressModel
let StudentWorkoutProgress
let getWorkoutPublicationStatus
const originalWindow = globalThis.window

before(async () => {
  // Keep the test local even when the developer has Supabase env variables.
  server = await createServer({
    mode: 'test', envFile: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
    server: { middlewareMode: true, hmr: false },
  })
  ;({ default: App, getExerciseLibrary, getExercisePickerResults, filterMobileWorkouts, sortWorkoutsByUpdatedAt, getStudentWorkoutExercises, buildWorkoutStudentPreviewState, StudentWorkoutExecution, StudentMobileApp, StudentWorkoutProgress, getExerciseFallbackImage, buildWorkoutCompletionPayload, buildWorkoutExecutionSummary, getStudentWorkoutExecutionStorageKey, buildStudentRewardStats, buildCoachStudentRanking, buildStudentWeekProgress, buildStudentExerciseProgressModel, reconcileMessageDelivery, getWorkoutPublicationStatus } = await server.ssrLoadModule('/src/App.jsx'))
  ;({ default: TrainerExerciseLibrary, getExerciseLibrarySyncCopy } = await server.ssrLoadModule('/src/TrainerExerciseLibrary.jsx'))
})

test('evolucao dos exercicios usa apenas treinos concluidos do aluno e calcula volume real', () => {
  const logs = [
    {
      id: 'history-1', studentId: student.id, workoutId: workout.id, completedAt: '2026-10-01T12:00:00Z',
      notes: 'Atividades registradas pelo aluno:\nSupino reto com barra — S1: 40 kg × 10 · S2: 42 kg × 8',
    },
    {
      id: 'history-2', studentId: student.id, workoutId: workout.id, completedAt: '2026-10-28T12:00:00Z',
      notes: 'Atividades registradas pelo aluno:\nSupino reto com barra — S1: 45 kg × 10 · S2: 45 kg × 10',
    },
    {
      id: 'other-student', studentId: 'private-student', completedAt: '2026-10-28T13:00:00Z',
      notes: 'Atividades registradas pelo aluno:\nSupino reto com barra — S1: 200 kg × 20',
    },
    {
      id: 'partial', studentId: student.id, completedAt: '2026-10-29T13:00:00Z', endedEarly: true,
      notes: 'Atividades registradas pelo aluno:\nSupino reto com barra — S1: 100 kg × 10',
    },
  ]
  const model = buildStudentExerciseProgressModel({
    studentId: student.id,
    workoutLogs: logs,
    workouts: [{ ...workout, days: [{ day: 'A', exercises: [{ name: 'Supino reto com barra', muscleGroup: 'Peitoral' }] }] }],
    range: 'all',
    now: '2026-10-29T18:00:00Z',
  })

  assert.equal(model.totalWorkouts, 2)
  assert.equal(model.exercises.length, 1)
  assert.equal(model.exercises[0].muscleGroup, 'Peitoral')
  assert.equal(model.exercises[0].sessions.length, 2)
  assert.equal(model.exercises[0].personalRecords.maxLoad, 45)
  assert.equal(model.exercises[0].loadChange, 3)
  assert.equal(model.totalVolume, 1636)
  assert.equal(model.updatedAt, '2026-10-28T12:00:00Z')

  const lastSevenDays = buildStudentExerciseProgressModel({
    studentId: student.id,
    workoutLogs: logs,
    workouts: [workout],
    range: '7',
    now: '2026-10-29T18:00:00Z',
  })
  assert.equal(lastSevenDays.totalWorkouts, 1)
  assert.equal(lastSevenDays.exercises[0].sessions.length, 1)
})

test('pagina Minha evolucao possui retorno, filtros e estado vazio sem inventar historico', () => {
  const html = renderToString(React.createElement(StudentWorkoutProgress, {
    student,
    workoutLogs: [],
    workouts: [workout],
    exerciseLibraryItems: [],
    onBack: () => {},
  }))

  assert.match(html, /Minha evolução/)
  assert.match(html, /Voltar para treinos/)
  assert.match(html, /7 dias/)
  assert.match(html, /30 dias/)
  assert.match(html, /90 dias/)
  assert.match(html, /Todo o período/)
  assert.match(html, /Nenhum treino concluído neste período/)
  assert.doesNotMatch(html, /0% de evolução/)
})

test('XP acumulado preserva meses anteriores e ignora duplicatas e outros pacientes', () => {
  const log = { id: 'log-a', studentId: student.id, completedAt: '2025-01-07T12:00:00Z' }
  const stats = buildStudentRewardStats({ studentId: student.id, workoutLogs: [log, log, { ...log, id: 'private', studentId: 'other' }] })
  assert.equal(stats.xp, 80)
  assert.equal(stats.history.length, 1)
})

test('XP de questionario usa conclusao persistida, nao o progresso de agua local', () => {
  const form = { id: 'form-a', studentId: student.id, status: 'Respondido', completedAt: '2025-02-01T12:00:00Z', xpAwarded: true }
  const stats = buildStudentRewardStats({ studentId: student.id, waterPercent: 100, questionnaireAssignments: [form, form, { ...form, id: 'private', studentId: 'other' }] })
  assert.equal(stats.xp, 60)
  assert.equal(stats.history.length, 1)
})

test('gamificacao do paciente nao exibe nem pontua treinos do perfil nutricional', () => {
  const log = { id: 'workout-hidden', studentId: student.id, completedAt: '2025-02-01T10:00:00Z' }
  const form = { id: 'nutrition-form', studentId: student.id, status: 'Respondido', completedAt: '2025-02-01T12:00:00Z', xpAwarded: true }
  const stats = buildStudentRewardStats({ studentId: student.id, profileType: 'patient', workoutLogs: [log], questionnaireAssignments: [form] })

  assert.equal(stats.xp, 60)
  assert.equal(stats.history.some((event) => event.kind === 'workout'), false)
  assert.equal(stats.badges.some((badge) => /treino/i.test(`${badge.label} ${badge.detail}`)), false)
  assert.equal(stats.sources.some((source) => /treino/i.test(`${source.label} ${source.detail}`)), false)
})

test('ranking e aluno exibem mesmo total e nivel sem bonus artificial de adesao', () => {
  const logs = Array.from({ length: 12 }, (_, i) => ({ id: `log-${i}`, studentId: student.id, completedAt: `2025-01-${String(i + 1).padStart(2, '0')}T12:00:00Z` }))
  const forms = [{ id: 'q', studentId: student.id, status: 'Respondido', completedAt: '2025-02-01T12:00:00Z', xpAwarded: true }]
  const stats = buildStudentRewardStats({ studentId: student.id, workoutLogs: logs, questionnaireAssignments: forms })
  const rank = buildCoachStudentRanking([{ ...student, adherence: 100 }], logs, forms)[0]
  assert.equal(rank.xp, stats.xp)
  assert.equal(rank.levelName, stats.levelName)
  assert.equal(stats.xp, 12 * 80 + 2 * 120 + 300 + 60)
  assert.equal(stats.history.filter(event => event.kind === 'monthly').length, 1)
})

test('replay de sessao nao concede XP novamente mesmo com outro id de log', () => {
  const log = { id: 'original', studentId: student.id, workoutId: 'workout', completionToken: 'session-unique-12345', completedAt: '2025-01-01T12:00:00Z' }
  assert.equal(buildStudentRewardStats({ studentId: student.id, workoutLogs: [log, { ...log, id: 'duplicate' }] }).xp, 80)
  assert.equal(buildStudentRewardStats({ studentId: student.id, workoutLogs: null, questionnaireAssignments: null }).xp, 0)
})

test('resposta de envio e polling concorrentes nao duplicam a mensagem otimista', () => {
  const saved = { id: 'server-id', body: 'Confirmada' }
  const current = [{ id: 'local-id', body: 'Enviando' }, { id: 'server-id', body: 'Chegou via polling' }, { id: 'other', body: 'Outra mensagem' }]
  assert.deepEqual(reconcileMessageDelivery(current, 'local-id', saved), [saved, current[2]])
  assert.deepEqual(reconcileMessageDelivery([saved], 'local-id', saved), [saved])
  assert.deepEqual(reconcileMessageDelivery(current, 'local-id', null), current.slice(1), 'Sessao encerrada remove somente o envio local pendente')
})

test('desafios usam os mesmos periodos e sessoes unicas do historico de XP', () => {
  const logs = ['2026-09-21T01:00:00Z', '2026-09-22T12:00:00Z', '2026-09-23T12:00:00Z'].map((completedAt, i) => ({ id: `tz-${i}`, completionToken: `session-${i}`, studentId: student.id, completedAt }))
  const stats = buildStudentRewardStats({ studentId: student.id, workoutLogs: [...logs, { ...logs[2], id: 'replay' }], now: new Date('2026-09-23T20:00:00Z') })
  assert.equal(stats.completedThisWeek, 2)
  assert.equal(stats.completedThisMonth, 3)
  assert.equal(stats.xp, 240)
  assert.equal(stats.badges.find(badge => badge.label === 'Treino').done, false)
  const calendar = buildStudentWeekProgress(stats.history, new Date('2026-09-23T20:00:00Z'))
  assert.equal(calendar.filter(day => day.completed).length, 2)
  assert.equal(calendar.find(day => day.isToday)?.key, '2026-09-23')
})

test('calendario ignora encerramentos parciais e usa o horario do produto', () => {
  const logs = [
    { id: 'done', studentId: student.id, completedAt: '2026-10-05T02:00:00Z' },
    { id: 'partial', studentId: student.id, completedAt: '2026-10-06T12:00:00Z', endedEarly: true },
  ]
  const stats = buildStudentRewardStats({ studentId: student.id, workoutLogs: logs, now: new Date('2026-10-05T18:00:00Z') })
  const calendar = buildStudentWeekProgress(stats.history, new Date('2026-10-05T18:00:00Z'))
  assert.equal(stats.completedThisWeek, 0, '02:00 UTC ainda era domingo no Brasil')
  assert.equal(calendar.filter(day => day.completed).length, 0)
})

after(async () => {
  await server?.close()
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})

for (const scenario of [
  { name: 'aluno cadastrado sem treinos', students: [student], workouts: [] },
  { name: 'aluno cadastrado com treino', students: [student], workouts: [workout] },
  { name: 'rascunho remoto recuperável', students: [student], workouts: [{ ...workout, active: false, publicationStatus: 'draft', status: 'Rascunho' }] },
  { name: 'conta nova sem alunos', students: [], workouts: [] },
  { name: 'dois alunos sem treino publicado', students: [student, { ...student, id: 'student-second', name: 'Segundo Aluno' }], workouts: [] },
  { name: 'alunos com e sem treino publicado', students: [student, { ...student, id: 'student-second', name: 'Segundo Aluno' }], workouts: [workout] },
  { name: 'alunos apenas com rascunho', students: [student, { ...student, id: 'student-second', name: 'Segundo Aluno' }], workouts: [{ ...workout, active: false, publicationStatus: 'draft', status: 'Rascunho' }] },
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
      assert.match(html, /Criar treino/)
      assert.match(html, /aria-label="Áreas de treinos"/)
    }
    if (scenario.workouts.some((item) => getWorkoutPublicationStatus(item, []) === 'published' && item.active !== false)) {
      assert.match(html, /Rotina Regressão/)
    } else {
      assert.doesNotMatch(html, /Rotina Regressão/)
    }
  })
}

test('navegacao de Treinos expande no desktop e preserva scroll em contêiner estreito', async () => {
  const cssSource = await readFile(new URL('../src/trainer-workout-build30.css', import.meta.url), 'utf8')

  assert.match(cssSource, /\.mobile-workout-manager \.trainer-workout-area-nav\s*\{[\s\S]{0,180}max-width:\s*none/)
  assert.match(cssSource, /@container\s*\(min-width:\s*900px\)[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(cssSource, /@container\s*\(min-width:\s*620px\) and \(max-width:\s*899px\)[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(cssSource, /@container\s*\(max-width:\s*619px\)[\s\S]*?overflow-x:\s*auto/)
  assert.match(cssSource, /trainer-workout-area-nav button strong\s*\{[\s\S]*?font-size:\s*clamp\(/)
})

test('tipografia esportiva usa fonte Barlow local apenas no display de Treinos', async () => {
  const cssSource = await readFile(new URL('../src/trainer-workout-build30.css', import.meta.url), 'utf8')
  const license = await readFile(new URL('../public/assets/fonts/OFL-Barlow.txt', import.meta.url), 'utf8')

  assert.match(cssSource, /@font-face\s*\{[^}]*font-family:\s*"Barlow Condensed"[^}]*font-weight:\s*600[^}]*barlow-condensed-latin-600\.woff2/s)
  assert.match(cssSource, /@font-face\s*\{[^}]*font-family:\s*"Barlow Condensed"[^}]*font-weight:\s*700[^}]*barlow-condensed-latin-700\.woff2/s)
  assert.match(cssSource, /@font-face\s*\{[^}]*font-family:\s*"Barlow Condensed"[^}]*font-weight:\s*800[^}]*barlow-condensed-latin-800\.woff2/s)
  assert.match(cssSource, /trainer-workout-shell-head h3[\s\S]*?font-family:\s*"Barlow Condensed"/)
  assert.doesNotMatch(cssSource, /fonts\.googleapis\.com|fonts\.gstatic\.com/)
  assert.match(license, /SIL OPEN FONT LICENSE/i)
  for (const weight of [600, 700, 800]) {
    const font = await readFile(new URL(`../public/assets/fonts/barlow-condensed-latin-${weight}.woff2`, import.meta.url))
    assert.equal(font.subarray(0, 4).toString(), 'wOF2')
  }
})

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

test('rascunho persistido pode ser retomado sem ressuscitar treino arquivado', async () => {
  const draftWorkout = { ...workout, active: false, title: 'Rascunho Recuperável' }
  const archivedWorkout = { ...workout, id: 'workout-archived', active: false, title: 'Treino Arquivado' }
  const storage = new Map([['fitcoach-ai-pro-v2', JSON.stringify({
    user: { id: 'coach-drafts', name: 'Treinador de rascunhos' },
    students: [student],
    workouts: [draftWorkout, archivedWorkout],
    workoutLogs: [{ id: 'archived-log', workoutId: archivedWorkout.id, studentId: student.id, completedAt: '2026-10-01T12:00:00.000Z' }],
  })]])
  globalThis.window = {
    localStorage: { getItem: (key) => storage.get(key) ?? null },
    location: new URL('http://localhost/?area=treinos'),
  }

  const html = renderToString(React.createElement(App))
  assert.match(html, /Rascunhos/)
  assert.match(html, /aria-controls="trainer-workout-panel-drafts"/)
  assert.doesNotMatch(html, /Rascunho Recuperável|Treino Arquivado/)
  assert.equal(getWorkoutPublicationStatus(draftWorkout, []), 'draft')
  assert.equal(getWorkoutPublicationStatus(archivedWorkout, [{ id: 'archived-log', workoutId: archivedWorkout.id }]), 'archived')
  const managerSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(managerSource, /const draftWorkouts = useMemo\([\s\S]{0,220}getWorkoutPublicationStatus\(workout, workoutLogs\) === 'draft'/)
  assert.match(managerSource, /tab === 'drafts'/)
  assert.match(managerSource, /filteredDraftWorkouts\.map\(\(workout\)/)
  assert.match(managerSource, /filteredLocalDraftSummaries\.map/)
  assert.match(managerSource, /Continuar rascunho/)
})

test('busca e filtros de Planos incluem aluno e exercícios de rascunho local', () => {
  const targetStudent = { id: 'student-filter', name: 'Mariana Silva' }
  const localDraft = {
    id: 'local-filtered-draft', studentId: targetStudent.id, title: 'Rascunho semanal', focus: 'Hipertrofia', status: 'Rascunho',
    days: [{ day: 'Segunda-feira', exercises: [{ name: 'Levantamento terra' }] }],
  }
  assert.equal(filterMobileWorkouts([localDraft], 'Mariana', 'todos', [targetStudent]).length, 1)
  assert.equal(filterMobileWorkouts([localDraft], 'Levantamento terra', 'todos', [targetStudent]).length, 1)
  assert.equal(filterMobileWorkouts([localDraft], 'Mariana', 'publicado', [targetStudent]).length, 0)
  assert.equal(filterMobileWorkouts([localDraft], 'não existe', 'todos', [targetStudent]).length, 0)
})

test('aluno escolhe entre vários treinos publicados na tela real', () => {
  const storage = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    location: new URL('http://localhost/?alunoTab=treino'),
    navigator: {},
    matchMedia: () => ({ matches: false }),
  }
  const studentWithAccess = { ...student, accessOverrideUntil: '2099-01-01T00:00:00.000Z' }
  const secondWorkout = { ...workout, id: 'workout-second', title: 'Treino de costas' }
  const html = renderToString(React.createElement(StudentMobileApp, {
    student: studentWithAccess,
    checkins: [],
    workouts: [workout, secondWorkout],
    nutritionPlans: [],
    workoutLogs: [],
    messages: [],
    appointments: [],
    invoices: [],
    assessments: [],
  }))

  assert.match(html, /student-workout-selector/)
  assert.match(html, /Rotina Regressão/)
  assert.match(html, /Treino de costas/)
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

  assert.ok(library.length >= 90)
  assert.ok(library.length <= 200)
  assert.equal(results.length, library.length)
  assert.ok(results.some((exercise) => exercise.name === 'Supino reto com barra'))
})

test('biblioteca do treinador separa objetivo, categoria, equipamento e fonte', () => {
  const html = renderToString(React.createElement(TrainerExerciseLibrary, {
    library: [
      { name: 'Supino com halteres', group: 'Peito', equipment: 'Halteres', objective: 'Força', category: 'Composto' },
      { name: 'Mobilidade de quadril', group: 'Quadril', equipment: 'Peso corporal', objective: 'Mobilidade', category: 'Aquecimento', isCustom: true, source: 'coach_custom' },
      { name: 'Remada externa', group: 'Costas', equipment: 'Elástico', objective: 'Estabilidade', category: 'Preparação', provider: 'ascendapi', source: 'ascendapi' },
    ],
    syncStatus: { status: 'empty', remoteCount: 0 },
  }))
  const objectiveControl = html.match(/<label>Objetivo[\s\S]*?<\/label>/)?.[0] || ''
  const categoryControl = html.match(/<label>Categoria[\s\S]*?<\/label>/)?.[0] || ''
  const sourceControl = html.match(/<label>Origem[\s\S]*?<\/label>/)?.[0] || ''

  assert.match(objectiveControl, /Força/)
  assert.match(objectiveControl, /Mobilidade/)
  assert.doesNotMatch(objectiveControl, /Composto|Aquecimento/)
  assert.match(categoryControl, /Composto/)
  assert.match(categoryControl, /Aquecimento/)
  assert.doesNotMatch(categoryControl, /Força|Mobilidade/)
  assert.match(html, /Equipamento/)
  assert.match(html, /Coach Fit Pro/)
  assert.match(html, /Meus exercícios/)
  assert.match(sourceControl, /Coach Fit Pro/)
  assert.match(sourceControl, /Ascendapi/)
  assert.match(sourceControl, /Meus exercícios/)
})

test('biblioteca distingue sincronizado, remoto vazio, indisponível e erro com fallback verdadeiro', () => {
  assert.match(getExerciseLibrarySyncCopy({ status: 'ready', remoteCount: 2 }, 92).title, /remoto disponível/)
  assert.match(getExerciseLibrarySyncCopy({ status: 'empty', remoteCount: 0 }, 92).detail, /local continua disponível/)
  assert.match(getExerciseLibrarySyncCopy({ status: 'unavailable', remoteCount: 0 }, 92).title, /indisponível/)
  assert.match(getExerciseLibrarySyncCopy({ status: 'error', remoteCount: 0 }, 92).detail, /consulta falhou/)
})

test('cópias de treino preservam a origem analítica e não publicam no atalho', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(appSource, /analyticsSource: isEditingExistingWorkout \? 'mobile_workout_edit' : 'mobile_library_duplicate'/)
  assert.match(appSource, /source: draft\.analyticsSource \|\| \(isEditingWorkout \? 'mobile_workout_edit' : 'mobile_workout_manager'\)/)
  assert.match(appSource, /function useWorkoutAsBase\([\s\S]*?mode: 'copy'/)
})

test('perfil selecionado na biblioteca mantém vídeo da sessão e taxonomia sem persisti-los como arquivo local', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const exerciseDraftSource = appSource.match(/function createExerciseDraft\([\s\S]*?\n\}/)?.[0] || ''
  const storageSanitizerSource = appSource.match(/function sanitizeWorkoutDaysForStorage\([\s\S]*?\n\}/)?.[0] || ''
  assert.match(exerciseDraftSource, /videoFile: profile\?\.videoFile \?\? null/)
  assert.match(exerciseDraftSource, /videoFileName: profile\?\.videoFileName \?\? ''/)
  assert.match(exerciseDraftSource, /category: profile\?\.category/)
  assert.match(exerciseDraftSource, /objective: profile\?\.objective \?\? profile\?\.goal/)
  assert.match(storageSanitizerSource, /videoFileName: ''/)
  assert.match(appSource, /durableExercise\.videoFileName = ''/)
})

test('mapper remoto lê fonte e taxonomia existentes sem exigir coluna nova', async () => {
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const mapper = apiSource.match(/function fromExerciseLibraryRow\(row\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(mapper, /row\.source_payload/)
  assert.match(mapper, /row\.provider/)
  assert.match(mapper, /category: row\.category \?\? sourcePayload\.category/)
  assert.match(mapper, /objective: row\.objective \?\? sourcePayload\.objective/)
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

test('filtro de equipamento não se mistura com categoria/objetivo', () => {
  const results = getExercisePickerResults({
    library: [
      { name: 'Flexão de braços', group: 'Peitoral', equipment: 'Peso corporal', category: 'Treino em casa' },
      { name: 'Remada com elástico', group: 'Costas', equipment: 'Elástico', category: 'Treino em casa' },
      { name: 'Supino com halteres', group: 'Peitoral', equipment: 'Halteres', category: 'Musculação' },
    ],
    equipmentFilter: 'Halteres',
  })

  assert.deepEqual(results.map((exercise) => exercise.name), ['Supino com halteres'])
  assert.deepEqual(getExercisePickerResults({
    library: [{ name: 'Supino com halteres', equipment: 'Halteres' }],
    categoryFilter: 'Halteres',
  }), [])
})

test('picker do editor filtra categoria, objetivo e equipamento de forma independente', () => {
  const library = [
    { name: 'Supino com barra', category: 'Composto', objective: 'Força', equipment: 'Barra' },
    { name: 'Elevação lateral', category: 'Isolado', objective: 'Hipertrofia', equipment: 'Halteres' },
  ]

  assert.deepEqual(getExercisePickerResults({ library, categoryFilter: 'Composto' }).map((item) => item.name), ['Supino com barra'])
  assert.deepEqual(getExercisePickerResults({ library, objectiveFilter: 'Força' }).map((item) => item.name), ['Supino com barra'])
  assert.deepEqual(getExercisePickerResults({ library, categoryFilter: 'Força' }), [])
  assert.deepEqual(getExercisePickerResults({ library, equipmentFilter: 'Halteres' }).map((item) => item.name), ['Elevação lateral'])
})

test('planos do aluno são ordenados pela atualização mais recente com desempate estável', () => {
  const workouts = [
    { id: 'mais-antigo', createdAt: '2026-01-01T10:00:00Z' },
    { id: 'mais-recente', updatedAt: '2026-02-03T10:00:00Z' },
    { id: 'sem-data-a' },
    { id: 'sem-data-b' },
  ]

  assert.deepEqual(sortWorkoutsByUpdatedAt(workouts).map((item) => item.id), [
    'mais-recente', 'mais-antigo', 'sem-data-a', 'sem-data-b',
  ])
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

test('montagem mantém seletor contextual, remove prévia lateral e não mostra miniaturas provisórias', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const managerSource = appSource.match(/function MobileWorkoutManager[\s\S]*?\r?\n}\r?\n\r?\nfunction createExerciseDraft/)?.[0] || ''
  const editableDaySource = appSource.match(/function MobileWorkoutEditableDay[\s\S]*?\r?\n}\r?\n\r?\nfunction createMobileWorkoutDraft/)?.[0] || ''
  const dayScreenSource = appSource.match(/function MobileWorkoutDayScreen[\s\S]*?\r?\n}\r?\n\r?\nfunction MobileWorkoutEditableDay/)?.[0] || ''

  assert.match(managerSource, /mobile-workout-student-picker/)
  assert.match(managerSource, /Aluno do treino/)
  assert.match(managerSource, /selectedDraftStudent/)
  assert.doesNotMatch(managerSource, /<WorkoutStudentLivePreview/)
  assert.doesNotMatch(managerSource, /has-student-preview/)
  assert.doesNotMatch(managerSource, /mobile-workout-picker-card-v2[^]{0,500}<ExerciseThumbnail/)
  assert.match(managerSource, /isCreatingCustomExercise/)
  assert.match(managerSource, /Voltar aos exercícios/)
  assert.match(managerSource, /setIsCreatingCustomExercise\(false\)/)
  assert.doesNotMatch(editableDaySource, /<ExerciseThumbnail/)
  assert.doesNotMatch(dayScreenSource, /<ExerciseThumbnail/)
})

test('biblioteca no tema escuro mantém contraste e a prévia permite voltar à lista', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  const managerSource = appSource.match(/function MobileWorkoutManager[\s\S]*?\r?\n}\r?\n\r?\nfunction createExerciseDraft/)?.[0] || ''
  const muscleSource = appSource.match(/function MuscleMap\([\s\S]*?\r?\n}\r?\n\r?\nfunction BodySilhouette/)?.[0] || ''

  assert.match(managerSource, /Voltar para lista/)
  assert.match(managerSource, /setExercisePickerPreview\(null\)/)
  assert.match(cssSource, /\.app-theme-dark \.mobile-workout-sheet\.is-exercise-picker \.mobile-workout-picker-card-v2[\s\S]*?background:/)
  assert.match(cssSource, /\.app-theme-dark \.mobile-workout-sheet\.is-exercise-picker \.mobile-workout-picker-card-copy strong[\s\S]*?color:/)
  assert.match(muscleSource, /onSelect=\{setSelectedMuscle\}/)
  assert.match(appSource, /role: 'button',[\s\S]*?'aria-pressed': selected,[\s\S]*?onClick: \(\) => onSelect\(key\)/)
})

test('prévia única usa em tempo real o mesmo executor, tema e biblioteca do aluno', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/student-workout-build30.css', import.meta.url), 'utf8')
  const editableDaySource = appSource.match(/function MobileWorkoutEditableDay[\s\S]*?\r?\n}\r?\n\r?\nfunction createMobileWorkoutDraft/)?.[0] || ''

  assert.match(editableDaySource, /student-mobile-shell student-workout-build30-device app-theme-\$\{theme\}/)
  assert.match(editableDaySource, /<StudentWorkoutExecution[\s\S]*workout=\{workout\}[\s\S]*exerciseLibraryItems=\{library\}[\s\S]*preview/)
  assert.match(cssSource, /\.student-workout-build30-preview-panel\s*\{[\s\S]*grid-template-columns:/)
  assert.match(cssSource, /@container student-workout-stage \(max-width: 540px\)/)
  assert.match(cssSource, /\.student-mobile-shell\.app-theme-light \.student-workout-build30-experience/)
})

test('ações do treino publicado mantêm contraste profissional no tema claro', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  const managerSource = appSource.match(/function MobileWorkoutManager[\s\S]*?\r?\n}\r?\n\r?\nfunction createExerciseDraft/)?.[0] || ''

  assert.match(managerSource, /className="is-secondary"[\s\S]*?Usar como base/)
  assert.match(managerSource, /className="is-accent"[\s\S]*?Adicionar exercício/)
  assert.match(cssSource, /\.app-theme-light \.mobile-workout-action-bar button\.is-secondary\s*\{[^}]*background:\s*#[0-9a-f]{6}[^}]*color:\s*#[0-9a-f]{6}/i)
  assert.match(cssSource, /\.app-theme-light \.mobile-workout-action-bar button\.is-accent\s*\{[^}]*background:\s*#[0-9a-f]{6}[^}]*color:\s*#fff(?:fff)?/i)
  assert.match(managerSource, /formatCount\(days\.length, 'dia'\)\} · \{formatCount\(exerciseCount, 'exercício'\)/)
  assert.doesNotMatch(managerSource, /formatCount\(days\.length \|\| 1, 'dia'\)/)
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
  assert.match(html, /Músculo principal/)
  assert.match(html, /Peitoral/)
  assert.match(html, /Meta de reps/)
  assert.match(html, /YouTube/)
  assert.doesNotMatch(html, /<iframe[^>]+youtube/i)
  assert.doesNotMatch(html, /muscle-map-region/)
  assert.doesNotMatch(html, /<img[^>]+Execução de Supino reto com barra/)
})

test('visão do aluno do treino publicado reutiliza o executor interativo fiel', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const componentSource = appSource.match(/function MobileWorkoutStudentPreview[\s\S]*?\r?\n}\r?\n\r?\nfunction summarizeWorkoutFocus/)?.[0] || ''

  assert.match(componentSource, /<StudentWorkoutExecution student=\{student\} workout=\{workout\} preview/)
  assert.doesNotMatch(componentSource, /mobile-workout-student-preview-days/)
})

test('dados de imagens permanecem disponíveis para uma atualização futura', () => {
  assert.equal(getExerciseFallbackImage({ name: 'Agachamento livre', group: 'Quadríceps e glúteos' }), '/assets/exercises/coachfit-lower-body.png')
  assert.equal(getExerciseFallbackImage({ name: 'Supino reto com barra', group: 'Peitoral' }), '/assets/exercises/coachfit-upper-push.png')
  assert.equal(getExerciseFallbackImage({ name: 'Remada baixa', group: 'Costas' }), '/assets/exercises/coachfit-upper-pull.png')
  assert.equal(getExerciseFallbackImage({ name: 'Prancha abdominal', group: 'Core' }), '/assets/exercises/coachfit-core.png')
})

test('interface de treino prioriza vídeo e não renderiza capas genéricas', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.doesNotMatch(appSource, /<img\s+src=\{getExerciseImageUrl\(exercise\)\}/)
  assert.match(appSource, /Ver execução no YouTube/)
  assert.match(appSource, /Buscar execução no YouTube/)
})

test('conclusão preserva séries, cargas e repetições no histórico do aluno', () => {
  const studentWithInviteCode = { ...student, inviteCode: 'CFP-TEST-123' }
  const payload = buildWorkoutCompletionPayload({
    student: studentWithInviteCode,
    workout: { id: 'workout-a', coachId: 'coach-a', title: 'Treino A' },
    effort: 'Forte',
    durationSeconds: 1540,
    exerciseEntries: [{
      exercise: { name: 'Supino reto com barra' },
      sets: [{ number: 1, completed: true, load: '40', reps: '10' }, { number: 2, completed: true, load: '42', reps: '8' }],
    }],
  })

  assert.equal(payload.studentId, student.id)
  assert.equal(payload.inviteCode, 'CFP-TEST-123')
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
  assert.match(managerSource, /beginNewWorkout\(student\.id\)/)
  assert.match(managerSource, /function useWorkoutAsBase\([\s\S]*?mode:\s*'copy'[\s\S]*?if \(opened\) setMessage/)
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

test('rascunho permanece privado e publicação fica disponível ao aluno', async () => {
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const migrationSource = await readFile(new URL('../supabase/migrations/20260915_workout_flow_readiness.sql', import.meta.url), 'utf8').catch(() => '')
  const lifecycleMigrationSource = await readFile(new URL('../supabase/migrations/20261012204511_workout_publication_lifecycle.sql', import.meta.url), 'utf8')

  assert.match(apiSource, /const publicationStatus = workout\.status === 'Rascunho'[\s\S]*?\? 'draft' : 'published'/)
  assert.match(apiSource, /publication_status:\s*publicationStatus/)
  assert.match(migrationSource, /workout_payload ->> 'publication_status'/i)
  assert.match(migrationSource, /active\s*=\s*v_is_published/i)
  assert.match(migrationSource, /workouts\.active is true/i)
  assert.match(lifecycleMigrationSource, /publication_status\s*=\s*v_publication_status/i)
  assert.match(lifecycleMigrationSource, /'draft',\s*'published',\s*'archived'/i)
})

test('portal de treinos valida convite e retorna somente treinos do aluno vinculado', async () => {
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const migrationSource = await readFile(new URL('../supabase/migrations/20260915_workout_flow_readiness.sql', import.meta.url), 'utf8').catch(() => '')

  assert.match(apiSource, /rpcRequest\('get_student_workouts',\s*\{ invite_code: code \}\)/)
  assert.match(migrationSource, /create or replace function public\.get_student_workouts\(invite_code text\)/i)
  assert.match(migrationSource, /student_invites\.status = 'active'/i)
  assert.match(migrationSource, /student_invites\.expires_at is null or student_invites\.expires_at > now\(\)/i)
  assert.match(migrationSource, /students\.coach_id = v_coach_id/i)
  assert.match(migrationSource, /workouts\.student_id = v_student_id/i)
  assert.match(migrationSource, /workouts\.coach_id = v_coach_id/i)
  assert.match(migrationSource, /workouts\.active is true/i)
})

test('conclusão do aluno fecha a sessão com token idempotente e vínculo validado', async () => {
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const migrationSource = await readFile(new URL('../supabase/migrations/20260915_workout_flow_readiness.sql', import.meta.url), 'utf8')

  assert.match(apiSource, /rpcRequest\('complete_student_workout_session'/)
  assert.match(apiSource, /completion_token: log\.completionToken/)
  assert.match(migrationSource, /create or replace function public\.complete_student_workout_session/i)
  assert.match(migrationSource, /from public\.student_invites/i)
  assert.match(migrationSource, /from public\.students[\s\S]*students\.coach_id = v_coach_id/i)
  assert.match(migrationSource, /student_id = v_student_id[\s\S]*coach_id = v_coach_id/i)
  assert.match(migrationSource, /pg_advisory_xact_lock/i)
  assert.match(migrationSource, /update[\s\S]*workout_sessions|insert into public\.workout_sessions/i)
  assert.match(migrationSource, /grant execute on function public\.complete_student_workout_session/i)
})

test('sincronizacao remota do treino informa carregamento, falha e permite tentar novamente', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /mobile-workout-sync-v8/)
  assert.match(appSource, /Recuperando seu progresso/)
  assert.match(appSource, /Tentar sincronizar novamente/)
  assert.match(appSource, /setHydrationAttempt\(\(current\) => current \+ 1\)/)
})

test('modais de treino usam portal e controle de foco fora do container principal', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /function useModalFocusTrap/)
  assert.match(appSource, /dayEditor \? createPortal/)
  assert.match(appSource, /ref=\{dayEditorDialogRef\}/)
  assert.match(appSource, /ref=\{endDialogRef\}/)
})

test('falha de arquivamento nao e mascarada como sucesso', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(apiSource, /Não foi possível confirmar o arquivamento do treino no banco/)
  assert.match(appSource, /const archived = await onArchiveWorkout\(workout\.id\)[\s\S]*if \(!archived\) throw/)
})

test('progressao preserva dias, cardio e metadados do treino original', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const progressionStart = appSource.indexOf('function buildWorkoutFromProgression')
  const progressionEnd = appSource.indexOf('function targetWasHit', progressionStart)
  const progressionSource = appSource.slice(progressionStart, progressionEnd)

  assert.match(progressionSource, /\.\.\.workout/)
  assert.match(progressionSource, /workout\.days\.map/)
  assert.match(progressionSource, /days\.flatMap/)
  assert.match(progressionSource, /buildWorkoutNotesWithMetadata\(nextWorkout\)/)
})

test('video enviado permanece referenciado nos metadados de dias', async () => {
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(apiSource, /mergeWorkoutExerciseMediaIntoMetadata\(workout\.notes, exercisesWithUploads\)/)
  assert.match(apiSource, /videoUrl:\s*uploaded\.videoUrl \|\| exercise\.videoUrl/)
  assert.match(apiSource, /imageUrl:\s*uploaded\.imageUrl \|\| uploaded\.thumbnailUrl \|\| exercise\.imageUrl/)
})

test('voltar aos dias pausa e persiste a duracao atual da sessao', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const returnStart = appSource.indexOf('function returnToDaySelection()')
  const returnEnd = appSource.indexOf('function buildCurrentWorkoutPayload()', returnStart)
  const returnSource = appSource.slice(returnStart, returnEnd)

  assert.match(returnSource, /durationSeconds/)
  assert.match(returnSource, /timerStartedAt:\s*''/)
  assert.match(returnSource, /persistStudentWorkoutExecution/)
  assert.match(returnSource, /onSaveWorkoutSession/)
})

test('falha de rede mantém a execução pendente para retry sem conceder XP local', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const completeWorkoutSource = appSource.match(/async function completeWorkout\(log\)[\s\S]*?\r?\n  }\r?\n\r?\n  async function endWorkout/)?.[0] || ''

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

test('biblioteca e editor oferecem cardio com campos condicionais', async () => {
  const library = getExerciseLibrary([])
  const treadmill = library.find((exercise) => exercise.name === 'Esteira')
  const bike = library.find((exercise) => exercise.name === 'Bike ergométrica')
  assert.equal(treadmill?.exerciseType, 'cardio')
  assert.equal(treadmill?.cardioMode, 'treadmill')
  assert.equal(bike?.cardioMode, 'bike')

  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const editorSource = appSource.match(/function MobileWorkoutEditableDay[\s\S]*?\r?\n}\r?\n\r?\nfunction createMobileWorkoutDraft/)?.[0] || ''
  const classicEditorSource = appSource.match(/function WorkoutForm[\s\S]*?\r?\n}\r?\n\r?\nfunction WorkoutList/)?.[0] || ''
  assert.match(editorSource, /Tipo de exercício/)
  assert.match(editorSource, /getCardioFieldDefinitions\(exercise\.cardioMode\)/)
  assert.match(editorSource, /formatCardioPrescription\(exercise\)/)
  assert.match(classicEditorSource, /buildWorkoutNotesWithMetadata\(\{ guidance, days \}\)/)
  assert.match(classicEditorSource, /getCardioFieldDefinitions\(exercise\.cardioMode\)/)
})

test('execução cardiovascular possui cronômetro, métricas e finalização própria', () => {
  const html = renderToString(React.createElement(StudentWorkoutExecution, {
    student,
    preview: true,
    workout: {
      title: 'Cardio',
      days: [{
        day: 'Terça-feira',
        focus: 'Condicionamento',
        exercises: [{
          name: 'Esteira', exerciseType: 'cardio', cardioMode: 'treadmill',
          durationMinutes: '30', distanceKm: '5', speedKmh: '10', inclinePercent: '2', intensity: 'Moderada',
        }],
      }],
    },
  }))

  assert.match(html, /Controle cardiovascular/)
  assert.match(html, /Iniciar cardio/)
  assert.match(html, /Distância realizada/)
  assert.match(html, /Finalizar cardio/)
  assert.doesNotMatch(html, /Registrar séries/)
})

test('progresso e histórico contabilizam cardio como uma atividade concluível', () => {
  const cardioWorkout = {
    id: 'cardio-a', coachId: 'coach-a', title: 'Cardio',
    days: [{ day: 'Dia 1', exercises: [{ name: 'Bike ergométrica', exerciseType: 'cardio', cardioMode: 'bike', durationMinutes: '20' }] }],
  }
  const summary = buildWorkoutExecutionSummary(cardioWorkout, {}, [], {
    '0-0': { completed: true, status: 'completed', elapsedSeconds: 1210 },
  })
  assert.equal(summary.totalSets, 1)
  assert.equal(summary.completedSets, 1)
  assert.equal(summary.canFinish, true)

  const payload = buildWorkoutCompletionPayload({
    student,
    workout: cardioWorkout,
    exerciseEntries: [{
      exercise: cardioWorkout.days[0].exercises[0],
      cardioLog: { completed: true, elapsedSeconds: 1210, distanceKm: '8.4', calories: '210' },
    }],
  })
  assert.match(payload.notes, /Bike ergométrica — 20:10 · 8,4 km · 210 kcal/)
})

test('mapa muscular diferencia músculos primários e secundários com tons de vermelho', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const regionsSource = appSource.match(/function MuscleRegions[\s\S]*?const back =/)?.[0] || ''
  assert.match(regionsSource, /const primary = '#ef4444'/)
  assert.match(regionsSource, /const secondary = '#fb7185'/)
})

test('adutores usam a referência anatômica dedicada enviada para o treino', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const image = await readFile(new URL('../public/assets/exercises/muscle-adutores.png', import.meta.url))

  assert.match(appSource, /adutores:\s*\{[^}]*image:\s*'\/assets\/exercises\/muscle-adutores\.png'/)
  assert.match(appSource, /profile\.primaryMuscle\s*===\s*'adutores'/)
  assert.match(appSource, /Mapa anatômico dos adutores/)
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
})


test('encerramento antecipado preserva histórico sem conceder XP de conclusão', () => {
  const partial = {
    id: 'partial-session',
    studentId: student.id,
    workoutId: workout.id,
    completedAt: '2026-09-26T12:00:00Z',
    endedEarly: true,
    notes: 'Supino reto com barra — S1: 40 kg × 10 reps',
  }
  const stats = buildStudentRewardStats({ studentId: student.id, workoutLogs: [partial] })
  assert.equal(stats.xp, 0)
  assert.equal(stats.completedThisWeek, 0)
  assert.equal(stats.history.length, 0)
})

test('executor destaca timer, encerramento e músculo alvo textual no topo', () => {
  const html = renderToString(React.createElement(StudentWorkoutExecution, {
    student,
    preview: true,
    dayIndex: 0,
    durationSeconds: 125,
    workout: {
      title: 'Treino A',
      days: [{
        day: 'Segunda-feira',
        focus: 'Peito',
        exercises: [{ name: 'Supino reto com barra', sets: '3', reps: '10', rest: '60s' }],
      }],
    },
  }))

  assert.match(html, /Tempo do treino/)
  assert.match(html, /02:05/)
  assert.match(html, /Encerrar treino/)
  assert.match(html, /mobile-workout-timer-panel-v5/)
  const exerciseTitleIndex = html.indexOf('Supino reto com barra')
  const muscleMapIndex = html.indexOf('mobile-workout-muscle-target-anatomy-v6')
  const timerIndex = html.indexOf('mobile-workout-timer-panel-v5')
  assert.ok(exerciseTitleIndex >= 0 && muscleMapIndex > exerciseTitleIndex && timerIndex > muscleMapIndex)
  assert.doesNotMatch(html, /muscle-map-region/)
  assert.doesNotMatch(html, /mobile-workout-muscle-target-compact-v5/)
  assert.match(html, /Músculo principal/)
  assert.match(html, /Peitoral/)
})

test('encerramento antecipado usa RPC dedicado e mantém validação da conclusão normal', async () => {
  const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const migrationSource = await readFile(new URL('../supabase/migrations/20260926_workout_early_end_history.sql', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(apiSource, /rpcRequest\('end_student_workout_session'/)
  assert.match(apiSource, /endedEarly:\s*WORKOUT_ENDED_EARLY_TOKEN_TEST\.test/)
  assert.match(migrationSource, /create or replace function public\.end_student_workout_session/i)
  assert.match(migrationSource, /status\s*=\s*'ended_early'/i)
  assert.match(migrationSource, /workout_sessions[\s\S]*execution/i)
  assert.match(appSource, /Deseja encerrar o treino agora\?/)
  assert.match(appSource, /Seu progresso realizado até aqui será mantido\./)
  assert.match(appSource, /if \(!dayCanFinish\)[\s\S]*Encerrar treino/)
})

test('tema claro e escuro têm estados acessíveis e timer tabular estável', async () => {
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(cssSource, /workout-execution-controls-v5/)
  assert.match(cssSource, /\.app-theme-light \.mobile-workout-student-experience-v2/)
  assert.match(cssSource, /\.app-theme-dark \.mobile-workout-student-experience-v2/)
  assert.match(cssSource, /button:focus-visible/)
  assert.match(cssSource, /button:not\(:disabled\):active/)
  assert.match(cssSource, /font-variant-numeric:\s*tabular-nums/)
  assert.match(cssSource, /width:\s*5\.7ch/)
})


test('descanso flutua acima da navegação e o tempo do treino permanece compacto', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(appSource, /mobile-workout-rest-floating-v6/)
  assert.match(appSource, /role="timer"/)
  assert.match(appSource, /aria-label=\{'Descanso: ' \+ formatWorkoutTimer\(restRemaining\)\}/)
  assert.match(cssSource, /workout-execution-polish-v6/)
  assert.match(cssSource, /\.mobile-workout-rest-floating-v6\s*\{[\s\S]*position:\s*fixed[\s\S]*z-index:\s*70/)
  assert.match(cssSource, /\.mobile-workout-session-timer-v5 > strong\s*\{[\s\S]*font-size:\s*clamp\(1\.55rem,\s*4\.5vw,\s*1\.9rem\)/)
  assert.match(cssSource, /bottom:\s*calc\(5\.35rem \+ env\(safe-area-inset-bottom, 0px\)\)/)
})

test('treino mobile premium mantém série ativa compacta e descanso arrastável sem duplicar timer', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(appSource, /restWidgetExpanded/)
  assert.match(appSource, /onPointerDown=\{beginRestWidgetDrag\}/)
  assert.match(appSource, /setPointerCapture/)
  assert.match(appSource, /visualViewport/)
  assert.match(appSource, /mobile-workout-rest-compact-v13/)
  assert.match(appSource, /mobile-workout-rest-expand-v13/)
  assert.match(appSource, /mobile-workout-set-card-v11/)
  assert.match(appSource, /mobile-workout-set-open-v11/)
  assert.match(appSource, /<StudentReminderCard[\s\S]*compact/)
  assert.match(cssSource, /workout-mobile-premium-v11/)
  assert.match(cssSource, /\.mobile-workout-rest-drag-handle-v11\s*\{[^}]*touch-action:\s*none/s)
  assert.match(cssSource, /\.mobile-workout-rest-floating-v6\.is-compact/)
  assert.match(cssSource, /\.mobile-workout-set-card-v11\.is-collapsed/)
  assert.match(cssSource, /safe-area-inset-bottom/)
})

test('treino mobile definitivo usa descanso em tela focada sem renderizar widget duplicado', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(appSource, /mobile-workout-command-v12/)
  assert.match(appSource, /mobile-workout-focus-v12/)
  assert.match(appSource, /mobile-workout-rest-portal-v12/)
  assert.doesNotMatch(appSource, /createPortal\(restWidget, document\.body\)/)
  assert.match(appSource, /student-workout-build30-rest-inline/)
  assert.match(appSource, /data-workout-theme=\{uiTheme\}/)
  assert.doesNotMatch(appSource, /mobile-workout-rest-portal-v12 app-theme-\$\{uiTheme\}/)
  assert.match(appSource, /mobile-workout-set-fields-v12/)
  assert.match(appSource, /viewport\?\.addEventListener\('scroll', constrainPosition\)/)
  assert.match(appSource, /viewport\?\.removeEventListener\('scroll', constrainPosition\)/)
  assert.doesNotMatch(appSource, /const viewportCenter = bounds\.offsetLeft/)
  assert.doesNotMatch(appSource, /const targetX = center < viewportCenter/)
  assert.match(cssSource, /workout-mobile-definitive-v12/)
  assert.match(cssSource, /\.mobile-workout-rest-portal-v12\s*\{[\s\S]*position:\s*fixed[\s\S]*pointer-events:\s*none/)
  assert.match(cssSource, /\.mobile-workout-rest-portal-v12\s*\{[\s\S]*background:\s*transparent\s*!important/)
  assert.match(cssSource, /\.mobile-workout-rest-portal-v12 \.mobile-workout-rest-floating-v6\s*\{[\s\S]*pointer-events:\s*auto/)
  assert.match(cssSource, /\.mobile-workout-rest-portal-v12\[data-workout-theme="light"\] \.mobile-workout-rest-floating-copy-v6 > strong\s*\{[\s\S]*color:\s*#14211f/)
  assert.match(cssSource, /\.mobile-workout-rest-portal-v12\[data-workout-theme="light"\] \.mobile-workout-rest-floating-card-v6\s*\{[\s\S]*background:\s*rgba\(255, 255, 255, 0\.98\)/)
  assert.match(cssSource, /\.mobile-workout-rest-portal-v12\[data-workout-theme="light"\] \.mobile-workout-rest-compact-v11/)
  assert.match(cssSource, /\.mobile-workout-command-v12 \.mobile-workout-exercise-dots-v3 > span\.is-current:not\(\.is-complete\)[\s\S]*background:\s*var\(--workout-v12-accent-soft\)/)
  assert.match(cssSource, /@media \(max-width:\s*767px\)[\s\S]*\.mobile-workout-command-v12/)
})

test('treino mobile premium limita a finalizacao ao ultimo exercicio sem perder o formulario', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /const isLastExercise = exercises\.length > 0 && safeExerciseIndex === exercises\.length - 1/)
  assert.match(appSource, /\{isLastExercise \? \(\s*<footer id="student-workout-finish"/)
  assert.match(appSource, /value=\{effort\}[\s\S]*value=\{sessionNotes\}/)
  assert.match(appSource, /disabled=\{saving \|\| !dayCanFinish \|\| Boolean\(completedLog\)\}/)
  assert.match(appSource, /student-workout-end-available/)
  assert.match(appSource, /inviteCode=\{inviteCode\}/)
})

test('timer flutuante separa toque de expandir do gesto de arraste', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(appSource, /function stopRestWidgetTogglePointer\(event\)/)
  assert.match(appSource, /onPointerDown=\{stopRestWidgetTogglePointer\}/)
  assert.match(appSource, /aria-expanded=\{restWidgetExpanded\}/)
  assert.match(cssSource, /\.mobile-workout-rest-compact-v11\s*\{[\s\S]*touch-action:\s*manipulation/s)
  assert.match(cssSource, /\.mobile-workout-rest-minimize-v11\s*\{[\s\S]*min-height:\s*44px[\s\S]*touch-action:\s*manipulation/s)
})

test('tema claro do treino usa superfícies neutras e teal do branding sem excesso de verde', async () => {
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(cssSource, /\.student-mobile-shell\.app-theme-light\.fit-gradient-bg\s*\{[\s\S]*#f1f4f2[\s\S]*linear-gradient\(180deg, #f7f9f8 0%, #eef2f0 100%\)/)
  assert.match(cssSource, /\.student-mobile-shell\.app-theme-light \.mobile-workout-student-experience-v2\s*\{[\s\S]*--workout-primary:\s*#0a7b6b[\s\S]*background:\s*#ffffff !important/)
  assert.match(cssSource, /\.mobile-workout-start-session-v4[\s\S]*background:\s*#0a7b6b !important/)
  assert.match(cssSource, /\.student-mobile-shell\.app-theme-light \.mobile-workout-rest-floating-card-v6\s*\{[\s\S]*background:\s*rgba\(255, 255, 255, 0\.97\)/)
})

test('tema claro mantém timer contido e hierarquia profissional nos controles', async () => {
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(cssSource, /workout-light-controls-v7/)
  assert.match(cssSource, /\.mobile-workout-timer-panel-v5\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%[\s\S]*overflow:\s*hidden/)
  assert.match(cssSource, /\.mobile-workout-session-timer-v5 > strong\s*\{[\s\S]*width:\s*auto[\s\S]*min-width:\s*8ch[\s\S]*max-width:\s*100%/)
  assert.match(cssSource, /@media \(max-width:\s*340px\)[\s\S]*\.mobile-workout-session-timer-v5\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/)
  assert.match(cssSource, /\.app-theme-light \.mobile-workout-orientations-v4\s*\{[\s\S]*background:\s*#eaf5f2/)
  assert.match(cssSource, /\.app-theme-light \.mobile-workout-orientations-v4 summary\s*\{[\s\S]*color:\s*#075f53/)
  assert.match(cssSource, /workout-light-controls-v7[\s\S]*mobile-workout-end-trigger-v5[\s\S]*background:\s*#fff8ea !important/)
})

test('tema claro usa verde safira e botão Voltar arredondado', async () => {
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(cssSource, /workout-sapphire-buttons-v8/)
  assert.match(cssSource, /workout-sapphire-buttons-v8[\s\S]*mobile-workout-finalize-primary-v5[\s\S]*background:\s*#087d6c !important/)
  assert.match(cssSource, /mobile-workout-execution-head-v4 > button:first-child[\s\S]*min-height:\s*44px[\s\S]*border-radius:\s*999px[\s\S]*background:\s*#eaf5f2 !important/)
})

test('tema claro diferencia ações positivas, informativas e de encerramento com contraste visível', async () => {
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(cssSource, /workout-light-action-hierarchy-v10/)
  assert.match(cssSource, /mobile-workout-day-card-actions-v4 > button:not\(\.is-secondary\)[\s\S]*background:\s*#087d6c !important/)
  assert.match(cssSource, /mobile-workout-summary-actions-v4 > button:not\(\.is-secondary\)[\s\S]*background:\s*#087d6c !important/)
  assert.match(cssSource, /mobile-workout-day-card-actions-v4 \.is-secondary[\s\S]*background:\s*#cce9e3 !important/)
  assert.match(cssSource, /mobile-workout-evolution-link-v4[\s\S]*background:\s*#cce9e3 !important/)
  assert.match(cssSource, /mobile-workout-finalize-primary-v5:disabled[\s\S]*background:\s*#a9c7c0 !important[\s\S]*opacity:\s*1 !important/)
  assert.match(cssSource, /mobile-workout-end-trigger-v5[\s\S]*background:\s*#f3cf7c !important/)
  assert.match(cssSource, /div\.is-complete > button[\s\S]*background:\s*#a8d9cd !important/)
})

test('controles do treino centralizam textos e preservam ação verde no tema claro', async () => {
  const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

  assert.match(cssSource, /workout-button-alignment-v14/)
  assert.match(cssSource, /\.mobile-workout-navigation-premium-v13\s*\{[\s\S]*width:\s*min\(100%, 420px\)[\s\S]*margin-inline:\s*auto/)
  assert.match(cssSource, /\.mobile-workout-navigation-premium-v13 button\s*\{[\s\S]*display:\s*inline-flex[\s\S]*justify-content:\s*center[\s\S]*text-align:\s*center/)
  assert.match(cssSource, /\.mobile-workout-set-open-v11\s*\{[\s\S]*place-items:\s*center[\s\S]*text-align:\s*center/)
  assert.match(cssSource, /\.student-mobile-shell\.app-theme-light[\s\S]*\.mobile-workout-set-card-v11:not\(\.is-complete\)[\s\S]*\.mobile-workout-set-fields-v12 > button:not\(:disabled\)[\s\S]*background:\s*#087d6c !important[\s\S]*color:\s*#fff !important/)
})


test('execução real do aluno mostra série atual, progresso do exercício e próxima ação contextual', async () => {
  const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const executionCss = await readFile(new URL('../src/student-workout-execution-build29.css', import.meta.url), 'utf8')
  const liveWorkout = {
    id: 'build29-live-series-workout', studentId: student.id, title: 'Treino de força',
    days: [{ day: 'Segunda-feira', focus: 'Peito', exercises: [{ name: 'Supino reto com barra', sets: '3', reps: '10', rest: '60s' }] }],
  }
  const storageKey = getStudentWorkoutExecutionStorageKey(student.id, liveWorkout.id)
  const savedSession = {
    completionToken: 'build29-live-series-session', activeDayIndex: 0, activeExerciseIndex: 0,
    setLogs: { '0-0-1': { load: '40', reps: '10', completed: true } }, cardioLogs: {},
    effort: 'Moderado', sessionNotes: '', durationSeconds: 125, timerStartedAt: '',
  }
  const previousWindow = globalThis.window
  globalThis.window = { localStorage: { getItem: (key) => key === storageKey ? JSON.stringify(savedSession) : null } }
  try {
    const html = renderToString(React.createElement(StudentWorkoutExecution, {
      student, workout: liveWorkout, preview: false,
    }))
    assert.match(html, /data-preview="false"/)
    assert.match(html, /mobile-workout-execution-v29/)
    assert.match(html, /1 de 3 séries/)
    assert.match(html, /aria-valuenow="1"/)
    assert.match(html, /Série atual/)
    assert.match(html, /Concluir série 2/)
    assert.match(html, /mobile-workout-execution-actionbar-v29/)

    const completeSetSource = appSource.match(/function completeSet\(setItem\) \{[\s\S]*?\n  \}/)?.[0] || ''
    assert.match(completeSetSource, /focusedField\.blur\(\)/)
    assert.doesNotMatch(completeSetSource, /getElementById\('workout-set-load-' \+ nextSet\.key\)\?\.focus/)
    assert.match(appSource, /onFocus=\{\(\) => setEntryFieldFocused\(true\)\}/)
    assert.match(executionCss, /mobile-workout-execution-v29\.is-entry-focused \.mobile-workout-execution-actionbar-v29/)
    assert.match(executionCss, /env\(safe-area-inset-bottom/)
  } finally {
    globalThis.window = previousWindow
  }
})
