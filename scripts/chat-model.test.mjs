import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildChatTimeline,
  buildConversationRows,
  formatChatDayLabel,
  sortChatMessages,
} from '../src/chat/chatModel.js'

test('sorts messages oldest first and tolerates invalid dates', () => {
  const sorted = sortChatMessages([
    { id: 'b', createdAt: '2026-09-20T12:00:00Z' },
    { id: 'invalid', createdAt: 'not-a-date' },
    { id: 'a', createdAt: '2026-09-20T10:00:00Z' },
  ])
  assert.deepEqual(sorted.map((item) => item.id), ['invalid', 'a', 'b'])
})

test('adds date separators and groups only consecutive messages from the same sender', () => {
  const timeline = buildChatTimeline([
    { id: '1', sender: 'student', createdAt: '2026-09-19T10:00:00-03:00' },
    { id: '2', sender: 'student', createdAt: '2026-09-19T10:02:00-03:00' },
    { id: '3', sender: 'coach', createdAt: '2026-09-19T10:03:00-03:00' },
    { id: '4', sender: 'coach', createdAt: '2026-09-20T10:03:00-03:00' },
  ], { now: new Date('2026-09-20T12:00:00-03:00'), groupGapMs: 5 * 60 * 1000 })

  assert.deepEqual(timeline.filter((item) => item.kind === 'date').map((item) => item.label), ['Ontem', 'Hoje'])
  const bubbles = timeline.filter((item) => item.kind === 'message')
  assert.equal(bubbles[0].isFirst, true)
  assert.equal(bubbles[0].isLast, false)
  assert.equal(bubbles[1].isFirst, false)
  assert.equal(bubbles[1].isLast, true)
  assert.equal(bubbles[2].isFirst, true)
})

test('orders conversations by latest activity and counts unread student messages', () => {
  const rows = buildConversationRows(
    [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    [
      { id: '1', studentId: 'a', sender: 'student', read: false, createdAt: '2026-09-20T10:00:00Z' },
      { id: '2', studentId: 'b', sender: 'coach', read: true, createdAt: '2026-09-20T12:00:00Z' },
    ],
  )

  assert.deepEqual(rows.map((row) => row.student.id), ['b', 'a'])
  assert.equal(rows[1].unreadCount, 1)
})

test('formats absolute dates without throwing on invalid values', () => {
  assert.equal(formatChatDayLabel('invalid', new Date('2026-09-20T12:00:00-03:00')), 'Data não informada')
})
