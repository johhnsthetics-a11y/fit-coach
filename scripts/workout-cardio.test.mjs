import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CARDIO_EXERCISES,
  buildCardioHistoryLine,
  formatCardioPrescription,
  getCardioFieldDefinitions,
  normalizeCardioExercise,
} from '../src/workoutCardio.js'

test('biblioteca cardiovascular inclui as modalidades essenciais', () => {
  assert.deepEqual(
    CARDIO_EXERCISES.map((exercise) => exercise.cardioMode),
    ['treadmill', 'bike', 'elliptical', 'rowing', 'stairs', 'walking'],
  )
})

test('cada modalidade exibe somente métricas relevantes', () => {
  assert.deepEqual(
    getCardioFieldDefinitions('treadmill').map((field) => field.key),
    ['durationMinutes', 'distanceKm', 'speedKmh', 'inclinePercent', 'caloriesTarget', 'intensity'],
  )
  assert.deepEqual(
    getCardioFieldDefinitions('bike').map((field) => field.key),
    ['durationMinutes', 'distanceKm', 'speedKmh', 'resistanceLevel', 'caloriesTarget', 'intensity'],
  )
  assert.deepEqual(
    getCardioFieldDefinitions('rowing').map((field) => field.key),
    ['durationMinutes', 'distanceKm', 'resistanceLevel', 'caloriesTarget', 'intensity'],
  )
})

test('normalização cardiovascular preserva compatibilidade e remove métricas irrelevantes', () => {
  assert.deepEqual(normalizeCardioExercise({
    name: 'Esteira',
    exerciseType: 'cardio',
    cardioMode: 'treadmill',
    durationMinutes: '30',
    distanceKm: '4.5',
    speedKmh: '9',
    inclinePercent: '2',
    resistanceLevel: '8',
    caloriesTarget: '320',
    intensity: 'Moderada',
  }), {
    name: 'Esteira',
    exerciseType: 'cardio',
    cardioMode: 'treadmill',
    durationMinutes: '30',
    distanceKm: '4.5',
    speedKmh: '9',
    inclinePercent: '2',
    caloriesTarget: '320',
    intensity: 'Moderada',
  })
})

test('prescrição e histórico cardiovascular usam dados planejados e realizados', () => {
  const exercise = {
    name: 'Bike ergométrica',
    exerciseType: 'cardio',
    cardioMode: 'bike',
    durationMinutes: '25',
    resistanceLevel: '6',
    intensity: 'Moderada',
  }
  assert.equal(formatCardioPrescription(exercise), '25 min · resistência 6 · intensidade Moderada')
  assert.equal(buildCardioHistoryLine(exercise, {
    completed: true,
    elapsedSeconds: 1510,
    distanceKm: '10.2',
    calories: '280',
  }), 'Bike ergométrica — 25:10 · 10,2 km · 280 kcal')
})
