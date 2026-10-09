import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProtocolTasksPrintHtml,
  formatProtocolDateKey,
  normalizeProtocolTaskDraft,
  protocolTaskFromRow,
  protocolTaskToRow,
} from '../src/protocolTasks.js'

const coachId = '11111111-1111-4111-8111-111111111111'
const studentId = '22222222-2222-4222-8222-222222222222'

test('normalizes a task draft and rejects invalid title, category, status, priority, and date', () => {
  const task = normalizeProtocolTaskDraft({
    title: '  Revisar treino  ',
    category: 'training',
    plannedDate: '2026-02-28',
    priority: 'high',
    status: 'in_progress',
    studentId,
    notes: '  Ajustar volume  ',
  })
  assert.deepEqual(task, {
    title: 'Revisar treino', category: 'training', plannedDate: '2026-02-28', priority: 'high',
    status: 'in_progress', studentId, notes: 'Ajustar volume',
  })
  for (const draft of [
    { title: '   ', category: 'training', plannedDate: '2026-02-28' },
    { title: 'Tarefa', category: 'other', plannedDate: '2026-02-28' },
    { title: 'Tarefa', category: 'training', plannedDate: '2026-02-30' },
    { title: 'Tarefa', category: 'training', plannedDate: '2026-02-28', priority: 'urgent' },
    { title: 'Tarefa', category: 'training', plannedDate: '2026-02-28', status: 'open' },
  ]) assert.throws(() => normalizeProtocolTaskDraft(draft))
})

test('maps database rows and binds write payload to the authenticated coach', () => {
  const row = {
    id: '33333333-3333-4333-8333-333333333333', coach_id: coachId, student_id: studentId,
    title: 'Revisar treino', category: 'training', planned_date: '2026-02-28',
    priority: 'normal', status: 'pending', notes: '', created_at: '2026-02-27T10:00:00Z', updated_at: '2026-02-27T10:00:00Z',
  }
  assert.deepEqual(protocolTaskFromRow(row), {
    id: row.id, coachId, studentId, title: row.title, category: row.category,
    plannedDate: row.planned_date, priority: 'normal', status: 'pending', notes: '',
    createdAt: row.created_at, updatedAt: row.updated_at,
  })
  assert.equal(protocolTaskToRow({ ...protocolTaskFromRow(row), coachId: 'attacker' }, coachId).coach_id, coachId)
  assert.throws(() => protocolTaskToRow({ title: 'Tarefa', category: 'general', plannedDate: '2026-02-28' }, 'invalid'))
})

test('formats date keys as local calendar dates without UTC day shifts', () => {
  assert.equal(formatProtocolDateKey('2026-01-02'), '02/01/2026')
  assert.equal(formatProtocolDateKey('2026-02-30'), '')
})

test('print HTML escapes task, student, professional and filter content including closing script tags', () => {
  const html = buildProtocolTasksPrintHtml({
    tasks: [{ title: '</script><img src=x onerror=alert(1)>', plannedDate: '2026-02-28', category: 'general', priority: 'normal', status: 'pending', notes: '<b>texto</b>', studentId }],
    students: [{ id: studentId, name: '<Aluno>' }],
    professional: { name: '<Profissional>' },
    fromDate: '2026-02-28', toDate: '2026-03-01',
    filters: { category: '<script>', status: 'pending' },
  })
  assert.ok(html.includes('&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;'))
  assert.ok(html.includes('&lt;Aluno&gt;'))
  assert.ok(html.includes('&lt;Profissional&gt;'))
  assert.ok(!html.includes('<img src=x'))
  assert.ok(!html.includes('<script><script>'))
})
