import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

function extractFunction(name) {
  const start = app.indexOf(`function ${name}`)
  if (start < 0) throw new Error(`Função ${name} não encontrada em src/App.jsx`)

  const paramsStart = app.indexOf('(', start)
  let paramsDepth = 0
  let bodyStart = -1
  for (let index = paramsStart; index < app.length; index += 1) {
    const char = app[index]
    if (char === '(') paramsDepth += 1
    if (char === ')') paramsDepth -= 1
    if (paramsDepth === 0) {
      bodyStart = app.indexOf('{', index)
      break
    }
  }
  if (bodyStart < 0) throw new Error(`Corpo da função ${name} não encontrado`)
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index]
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = ''
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return app.slice(start, index + 1)
  }

  throw new Error(`Não foi possível extrair ${name}`)
}

const normalizeText = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const source = [
  'const console = { warn() {}, error() {}, log() {} };',
  extractFunction('normalizeStringArray'),
  extractFunction('normalizeWorkoutExerciseInput'),
  extractFunction('getWorkoutExercisesArray'),
  extractFunction('normalizeWorkoutDayInput'),
  extractFunction('getWorkoutDaysArray'),
  extractFunction('normalizeWorkoutRecord'),
  'return { normalizeStringArray, normalizeWorkoutExerciseInput, getWorkoutExercisesArray, normalizeWorkoutDayInput, getWorkoutDaysArray, normalizeWorkoutRecord };',
].join('\n')

let helpers
try {
  helpers = new Function('normalizeText', source)(normalizeText)
} catch (error) {
  console.error(source.split('\n').slice(0, 90).join('\n'))
  throw error
}

const legacyWorkouts = [
  { id: 'undefined-exercises', exercises: undefined },
  { id: 'null-exercises', exercises: null, days: null },
  { id: 'string-exercises', exercises: 'Supino reto, Remada baixa', days: 'Segunda-feira;Quarta-feira' },
  {
    id: 'object-exercises',
    exercises: { exercise_name: 'Agachamento livre', secondary_muscles: 'glúteos; adutores' },
    days: { title: 'Dia legado', exercises: { movement: 'Leg press', secondary_muscles: 'glúteos, panturrilhas' } },
  },
  {
    id: 'legacy-days',
    exercises: [],
    days: [{ name: 'Dia A', items: 'Supino inclinado; Rosca direta' }, { day: 'Dia B', exercises: { movement: 'Stiff' } }],
  },
]

const normalized = legacyWorkouts.map((workout) => helpers.normalizeWorkoutRecord(workout))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

normalized.forEach((workout) => {
  assert(Array.isArray(workout.exercises), `${workout.id}: exercises não virou array`)
  assert(Array.isArray(workout.days), `${workout.id}: days não virou array`)
  workout.days.forEach((day, index) => {
    assert(day && typeof day === 'object', `${workout.id}: dia ${index} inválido`)
    assert(Array.isArray(day.exercises), `${workout.id}: exercícios do dia ${index} não viraram array`)
  })
  workout.exercises.forEach((exercise, index) => {
    assert(Array.isArray(exercise.secondaryMuscles), `${workout.id}: secondaryMuscles do exercício ${index} não virou array`)
  })
})

assert(normalized.find((workout) => workout.id === 'string-exercises').exercises.length === 2, 'String de exercícios não foi recuperada')
assert(normalized.find((workout) => workout.id === 'object-exercises').days.length === 1, 'Objeto legado de dia não foi recuperado')
assert(normalized.find((workout) => workout.id === 'legacy-days').days[0].exercises.length === 2, 'items legado do dia não foi recuperado')

console.log('Workout shape smoke check passed')
