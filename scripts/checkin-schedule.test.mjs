import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCheckinScheduleStatus,
  normalizeCheckinScheduleDate,
  shouldNotifyCheckinSchedule,
} from '../src/checkinSchedule.js'

test('agenda usa datas civis ISO e rejeita texto livre', () => {
  assert.equal(normalizeCheckinScheduleDate('2026-10-25'), '2026-10-25')
  assert.equal(normalizeCheckinScheduleDate('domingo'), '')
  assert.equal(normalizeCheckinScheduleDate('2026-02-30'), '')
})

test('status distingue agendado, hoje, atrasado e enviado', () => {
  const now = new Date(2026, 9, 21, 12, 0)
  assert.equal(getCheckinScheduleStatus('2026-10-25', [], now).kind, 'scheduled')
  assert.equal(getCheckinScheduleStatus('2026-10-21', [], now).kind, 'due')
  assert.equal(getCheckinScheduleStatus('2026-10-20', [], now).kind, 'overdue')
  assert.equal(getCheckinScheduleStatus('2026-10-20', [{ createdAt: '2026-10-20T15:00:00-03:00' }], now).kind, 'sent')
})

test('notificação local é emitida uma vez por aluno e data', () => {
  const storage = new Map()
  const adapter = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
  }
  assert.equal(shouldNotifyCheckinSchedule({ studentId: 'student-1', dueDate: '2026-10-21', kind: 'due', storage: adapter }), true)
  assert.equal(shouldNotifyCheckinSchedule({ studentId: 'student-1', dueDate: '2026-10-21', kind: 'due', storage: adapter }), false)
  assert.equal(shouldNotifyCheckinSchedule({ studentId: 'student-1', dueDate: '2026-10-22', kind: 'scheduled', storage: adapter }), false)
})
