export const CHAT_GROUP_GAP_MS = 5 * 60 * 1000

function timestampOf(value) {
  const timestamp = new Date(value ?? 0).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function dateFrom(value) {
  const date = new Date(value ?? '')
  return Number.isFinite(date.getTime()) ? date : null
}

function localDayKey(value) {
  const date = value instanceof Date ? value : dateFrom(value)
  if (!date) return 'unknown'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getStableMessageKey(message, index = 0) {
  return String(message?.id || `${message?.sender || 'message'}-${timestampOf(message?.createdAt)}-${index}`)
}

export function sortChatMessages(messages = []) {
  return [...(Array.isArray(messages) ? messages : [])]
    .map((message, index) => ({ message, index }))
    .sort((a, b) => timestampOf(a.message?.createdAt) - timestampOf(b.message?.createdAt) || a.index - b.index)
    .map(({ message }) => message)
}

export function formatChatDayLabel(value, now = new Date()) {
  const date = value instanceof Date ? value : dateFrom(value)
  const reference = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date()
  if (!date) return 'Data não informada'

  const dateKey = localDayKey(date)
  if (dateKey === localDayKey(reference)) return 'Hoje'

  const yesterday = new Date(reference)
  yesterday.setHours(12, 0, 0, 0)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === localDayKey(yesterday)) return 'Ontem'

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === reference.getFullYear() ? undefined : 'numeric',
  }).format(date)
}

function belongsToSameGroup(current, neighbor, groupGapMs) {
  if (!current || !neighbor || current.sender !== neighbor.sender) return false
  if (localDayKey(current.createdAt) !== localDayKey(neighbor.createdAt)) return false
  return Math.abs(timestampOf(current.createdAt) - timestampOf(neighbor.createdAt)) <= groupGapMs
}

export function buildChatTimeline(messages = [], { now = new Date(), groupGapMs = CHAT_GROUP_GAP_MS } = {}) {
  const ordered = sortChatMessages(messages)
  const timeline = []
  let activeDayKey = ''

  ordered.forEach((message, index) => {
    const dayKey = localDayKey(message?.createdAt)
    if (dayKey !== activeDayKey) {
      timeline.push({
        kind: 'date',
        key: `date-${dayKey}-${index}`,
        label: formatChatDayLabel(message?.createdAt, now),
      })
      activeDayKey = dayKey
    }

    timeline.push({
      kind: 'message',
      key: getStableMessageKey(message, index),
      message,
      isFirst: !belongsToSameGroup(message, ordered[index - 1], groupGapMs),
      isLast: !belongsToSameGroup(message, ordered[index + 1], groupGapMs),
    })
  })

  return timeline
}

export function buildConversationRows(students = [], messages = []) {
  const safeMessages = Array.isArray(messages) ? messages : []

  return (Array.isArray(students) ? students : [])
    .map((student, index) => {
      const studentMessages = sortChatMessages(safeMessages.filter((message) => (
        String(message?.studentId ?? '') === String(student?.id ?? '')
      )))
      const latestMessage = studentMessages.at(-1) || null
      const activityAt = latestMessage?.createdAt || student?.updatedAt || student?.createdAt || ''

      return {
        student,
        messages: studentMessages,
        latestMessage,
        unreadCount: studentMessages.filter((message) => message?.sender === 'student' && !message?.read).length,
        activityAt,
        index,
      }
    })
    .sort((a, b) => timestampOf(b.activityAt) - timestampOf(a.activityAt) || a.index - b.index)
    .map(({ index: _index, ...row }) => row)
}
