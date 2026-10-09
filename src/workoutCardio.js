const CARDIO_FIELDS = {
  durationMinutes: { key: 'durationMinutes', label: 'Duração', placeholder: 'min', inputMode: 'numeric' },
  distanceKm: { key: 'distanceKm', label: 'Distância', placeholder: 'km', inputMode: 'decimal' },
  speedKmh: { key: 'speedKmh', label: 'Velocidade', placeholder: 'km/h', inputMode: 'decimal' },
  inclinePercent: { key: 'inclinePercent', label: 'Inclinação', placeholder: '%', inputMode: 'decimal' },
  resistanceLevel: { key: 'resistanceLevel', label: 'Resistência', placeholder: 'nível', inputMode: 'decimal' },
  caloriesTarget: { key: 'caloriesTarget', label: 'Calorias', placeholder: 'kcal', inputMode: 'numeric' },
  intensity: { key: 'intensity', label: 'Intensidade', type: 'select', options: ['Leve', 'Moderada', 'Forte', 'Muito forte'] },
}

const CARDIO_MODE_FIELDS = {
  treadmill: ['durationMinutes', 'distanceKm', 'speedKmh', 'inclinePercent', 'caloriesTarget', 'intensity'],
  bike: ['durationMinutes', 'distanceKm', 'speedKmh', 'resistanceLevel', 'caloriesTarget', 'intensity'],
  elliptical: ['durationMinutes', 'distanceKm', 'resistanceLevel', 'caloriesTarget', 'intensity'],
  rowing: ['durationMinutes', 'distanceKm', 'resistanceLevel', 'caloriesTarget', 'intensity'],
  stairs: ['durationMinutes', 'resistanceLevel', 'caloriesTarget', 'intensity'],
  walking: ['durationMinutes', 'distanceKm', 'speedKmh', 'inclinePercent', 'caloriesTarget', 'intensity'],
}

export const CARDIO_EXERCISES = [
  {
    name: 'Esteira', cardioMode: 'treadmill', group: 'Cardiovascular', equipment: 'Esteira',
    primaryMuscle: 'quadriceps', secondaryMuscles: ['gluteos', 'posteriores', 'panturrilhas'],
    cues: 'Mantenha postura ereta, passadas naturais e ajuste velocidade e inclinação de forma progressiva.',
    aliases: ['corrida na esteira', 'treadmill'],
  },
  {
    name: 'Bike ergométrica', cardioMode: 'bike', group: 'Cardiovascular', equipment: 'Bicicleta ergométrica',
    primaryMuscle: 'quadriceps', secondaryMuscles: ['gluteos', 'posteriores', 'panturrilhas'],
    cues: 'Ajuste o banco à altura do quadril, mantenha os joelhos alinhados e pedale com cadência estável.',
    aliases: ['bicicleta', 'bike', 'spinning'],
  },
  {
    name: 'Elíptico', cardioMode: 'elliptical', group: 'Cardiovascular', equipment: 'Elíptico',
    primaryMuscle: 'quadriceps', secondaryMuscles: ['gluteos', 'posteriores', 'panturrilhas'],
    cues: 'Distribua o peso entre braços e pernas, preserve o tronco estável e mantenha movimento contínuo.',
    aliases: ['transport', 'elliptical'],
  },
  {
    name: 'Remo ergométrico', cardioMode: 'rowing', group: 'Cardiovascular', equipment: 'Remo ergométrico',
    primaryMuscle: 'costas', secondaryMuscles: ['dorsal', 'biceps', 'gluteos', 'quadriceps'],
    cues: 'Inicie pelas pernas, estabilize o tronco e finalize puxando a alça em direção às costelas.',
    aliases: ['remo indoor', 'rowing machine'],
  },
  {
    name: 'Escada ergométrica', cardioMode: 'stairs', group: 'Cardiovascular', equipment: 'Escada ergométrica',
    primaryMuscle: 'gluteos', secondaryMuscles: ['quadriceps', 'posteriores', 'panturrilhas'],
    cues: 'Apoie o pé por completo, mantenha o tronco alto e evite descarregar o peso nos braços.',
    aliases: ['escada', 'stair climber'],
  },
  {
    name: 'Caminhada', cardioMode: 'walking', group: 'Cardiovascular', equipment: 'Esteira ou ambiente externo',
    primaryMuscle: 'quadriceps', secondaryMuscles: ['gluteos', 'posteriores', 'panturrilhas'],
    cues: 'Use passadas confortáveis, braços soltos e intensidade compatível com a zona planejada.',
    aliases: ['caminhada na esteira', 'walking'],
  },
].map((exercise) => ({ ...exercise, exerciseType: 'cardio', objective: 'Condicionamento cardiovascular' }))

export function isCardioExercise(exercise = {}) {
  return exercise.exerciseType === 'cardio' || Boolean(exercise.cardioMode)
}

export function getCardioFieldDefinitions(mode = '') {
  return (CARDIO_MODE_FIELDS[mode] || CARDIO_MODE_FIELDS.treadmill).map((key) => CARDIO_FIELDS[key])
}

export function normalizeCardioExercise(exercise = {}) {
  if (!isCardioExercise(exercise)) return { ...exercise }
  const mode = CARDIO_MODE_FIELDS[exercise.cardioMode] ? exercise.cardioMode : 'treadmill'
  const allowed = new Set(getCardioFieldDefinitions(mode).map((field) => field.key))
  const normalized = { ...exercise, exerciseType: 'cardio', cardioMode: mode }
  Object.keys(CARDIO_FIELDS).forEach((key) => {
    if (!allowed.has(key)) delete normalized[key]
  })
  return normalized
}

function readableDecimal(value) {
  return String(value || '').replace('.', ',')
}

export function formatCardioPrescription(exercise = {}) {
  if (!isCardioExercise(exercise)) return ''
  const values = []
  if (exercise.durationMinutes) values.push(`${exercise.durationMinutes} min`)
  if (exercise.distanceKm) values.push(`${readableDecimal(exercise.distanceKm)} km`)
  if (exercise.speedKmh) values.push(`${readableDecimal(exercise.speedKmh)} km/h`)
  if (exercise.inclinePercent) values.push(`inclinação ${readableDecimal(exercise.inclinePercent)}%`)
  if (exercise.resistanceLevel) values.push(`resistência ${exercise.resistanceLevel}`)
  if (exercise.caloriesTarget) values.push(`${exercise.caloriesTarget} kcal`)
  if (exercise.intensity) values.push(`intensidade ${exercise.intensity}`)
  return values.join(' · ') || 'Cardio livre'
}

function formatElapsed(seconds = 0) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function buildCardioHistoryLine(exercise = {}, log = {}) {
  const values = [formatElapsed(log.elapsedSeconds)]
  if (log.distanceKm) values.push(`${readableDecimal(log.distanceKm)} km`)
  if (log.calories) values.push(`${log.calories} kcal`)
  if (log.speedKmh) values.push(`${readableDecimal(log.speedKmh)} km/h`)
  return `${exercise.name || 'Cardio'} — ${values.join(' · ')}`
}

export function createCardioLog(log = {}) {
  return {
    status: ['running', 'paused', 'completed'].includes(log.status) ? log.status : 'idle',
    elapsedSeconds: Math.max(0, Math.floor(Number(log.elapsedSeconds) || 0)),
    startedAt: String(log.startedAt || ''),
    distanceKm: String(log.distanceKm || ''),
    speedKmh: String(log.speedKmh || ''),
    calories: String(log.calories || ''),
    intensity: String(log.intensity || ''),
    completed: Boolean(log.completed || log.status === 'completed'),
  }
}
