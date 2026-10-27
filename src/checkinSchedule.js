const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function normalizeCheckinScheduleDate(value = '') {
  const dateKey = String(value || '').trim()
  if (!ISO_DATE_PATTERN.test(dateKey)) return ''
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? dateKey : ''
}

function localDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function checkinDateKey(checkin = {}) {
  const value = checkin.createdAt || checkin.date || ''
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? normalizeCheckinScheduleDate(value) : localDateKey(date)
}

export function getCheckinScheduleStatus(dueDate, checkins = [], now = new Date()) {
  const normalizedDueDate = normalizeCheckinScheduleDate(dueDate)
  if (!normalizedDueDate) return { kind: 'unscheduled', dueDate: '', label: 'Sem data definida' }
  const sent = checkins.some((checkin) => checkinDateKey(checkin) >= normalizedDueDate)
  if (sent) return { kind: 'sent', dueDate: normalizedDueDate, label: 'Check-in enviado' }
  const today = localDateKey(now)
  if (normalizedDueDate < today) return { kind: 'overdue', dueDate: normalizedDueDate, label: 'Check-in atrasado' }
  if (normalizedDueDate === today) return { kind: 'due', dueDate: normalizedDueDate, label: 'Enviar hoje' }
  return { kind: 'scheduled', dueDate: normalizedDueDate, label: 'Check-in agendado' }
}

export function shouldNotifyCheckinSchedule({ studentId, dueDate, kind, storage = globalThis.localStorage } = {}) {
  if (!['due', 'overdue'].includes(kind) || !studentId || !normalizeCheckinScheduleDate(dueDate) || !storage?.getItem) return false
  const key = `coachfit.checkin.notice.${studentId}.${dueDate}`
  if (storage.getItem(key)) return false
  storage.setItem?.(key, new Date().toISOString())
  return true
}
