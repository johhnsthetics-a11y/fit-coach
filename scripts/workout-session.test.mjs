import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  mergeWorkoutSession,
  normalizeWorkoutSession,
  serializeWorkoutSession,
} from '../src/workoutSession.js'

const base = {
  completionToken: 'session-token-12345',
  status: 'in_progress',
  workoutId: 'workout-a',
  activeDayIndex: 0,
  activeExerciseIndex: 1,
  setLogs: { '0-0-1': { completed: true, load: '20', reps: '10' } },
  effort: 'Moderado',
  sessionNotes: '',
  durationSeconds: 42,
  updatedAt: '2026-09-15T12:00:00.000Z',
}

test('normaliza sessão válida sem compartilhar referências mutáveis', () => {
  const normalized = normalizeWorkoutSession(base)
  assert.equal(normalized.completionToken, base.completionToken)
  assert.equal(normalized.durationSeconds, 42)
  assert.deepEqual(normalized.setLogs, base.setLogs)
  assert.notEqual(normalized.setLogs, base.setLogs)
})

test('rejeita sessão vazia ou token inválido', () => {
  assert.equal(normalizeWorkoutSession(null), null)
  assert.equal(normalizeWorkoutSession({ completionToken: 'curto' }), null)
})

test('sessão remota mais recente vence o cache local da mesma execução', () => {
  const local = { ...base, durationSeconds: 20, updatedAt: '2026-09-15T12:00:00.000Z' }
  const remote = { ...base, durationSeconds: 80, updatedAt: '2026-09-15T12:01:00.000Z' }
  assert.equal(mergeWorkoutSession(local, remote).durationSeconds, 80)
})

test('nova sessão em andamento não é substituída por sessão concluída antiga', () => {
  const completed = { ...base, completionToken: 'completed-token-123', status: 'completed', updatedAt: '2026-09-15T12:05:00.000Z' }
  const fresh = { ...base, completionToken: 'fresh-session-token', status: 'in_progress', updatedAt: '2026-09-15T12:04:00.000Z' }
  assert.equal(mergeWorkoutSession(fresh, completed).completionToken, fresh.completionToken)
})

test('serialização envia somente o contrato persistível', () => {
  assert.deepEqual(serializeWorkoutSession({ ...base, ignored: 'value' }), {
    activeDayIndex: 0,
    activeExerciseIndex: 1,
    setLogs: base.setLogs,
    effort: 'Moderado',
    sessionNotes: '',
    durationSeconds: 42,
    timerStartedAt: '',
    updatedAt: '2026-09-15T12:00:00.000Z',
  })
})
