import test from 'node:test'
import assert from 'node:assert/strict'
import * as chatModel from '../src/chat/chatModel.js'
import { getChatViewportMetrics } from '../src/chat/chatViewportModel.js'

const {
  buildChatTimeline,
  buildConversationRows,
  formatChatDayLabel,
  sortChatMessages,
} = chatModel

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

test('tracks the visible mobile viewport while the virtual keyboard is open', () => {
  assert.deepEqual(getChatViewportMetrics({
    visualViewport: { height: 518.4, offsetTop: 126.6 },
    innerHeight: 844,
  }), {
    height: 518,
    offsetTop: 127,
    keyboardHeight: 199,
    keyboardOpen: true,
  })
})

test('detects the iPhone keyboard when innerHeight shrinks together with visualViewport', () => {
  assert.deepEqual(getChatViewportMetrics({
    visualViewport: { height: 470, offsetTop: 0 },
    innerHeight: 470,
    baselineHeight: 852,
  }), {
    height: 470,
    offsetTop: 0,
    keyboardHeight: 382,
    keyboardOpen: true,
  })
})

test('falls back safely when visual viewport metrics are unavailable', () => {
  assert.deepEqual(getChatViewportMetrics({
    visualViewport: { height: Number.NaN, offsetTop: -20 },
    innerHeight: 640.2,
  }), {
    height: 640,
    offsetTop: 0,
    keyboardHeight: 0,
    keyboardOpen: false,
  })
})

test('identifies only a new incoming student message and suppresses the open conversation', () => {
  assert.equal(typeof chatModel.findLatestIncomingStudentMessage, 'function')
  const previous = [
    { id: 'existing', studentId: 'student-a', sender: 'student', body: 'Mensagem antiga', createdAt: '2026-10-21T12:00:00Z' },
  ]
  const next = [
    { id: 'coach-message', studentId: 'student-a', sender: 'coach', body: 'Resposta', createdAt: '2026-10-21T12:02:00Z' },
    { id: 'incoming', studentId: 'student-b', sender: 'student', body: 'Preciso ajustar meu plano', createdAt: '2026-10-21T12:03:00Z' },
    ...previous,
  ]

  assert.equal(chatModel.findLatestIncomingStudentMessage(previous, next)?.id, 'incoming')
  assert.equal(chatModel.findLatestIncomingStudentMessage(previous, next, {
    activeView: 'mensagens',
    activeStudentId: 'student-b',
  }), null)
  assert.equal(chatModel.findLatestIncomingStudentMessage(previous, [...previous, next[0]]), null)
})

test('builds a concise role-aware incoming message alert', () => {
  assert.equal(typeof chatModel.buildIncomingMessageAlert, 'function')
  assert.deepEqual(chatModel.buildIncomingMessageAlert(
    { id: 'message-1', studentId: 'patient-1', body: '  Minha digestão melhorou bastante esta semana.  ' },
    [{ id: 'patient-1', name: 'Marina Costa' }],
    { professionalType: 'nutritionist' },
  ), {
    id: 'message-1',
    studentId: 'patient-1',
    title: 'Nova mensagem de Marina',
    body: 'Minha digestão melhorou bastante esta semana.',
    audienceLabel: 'paciente',
  })
})
