const WEEKDAY_ROOTS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

function normalizeWeekdayLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function getLocalWeekdayIndex(date = new Date()) {
  const candidate = date instanceof Date ? date : new Date(date)
  return Number.isNaN(candidate.getTime()) ? -1 : candidate.getDay()
}

/**
 * Returns a day index only when its explicit label names today's local weekday
 * and exactly one day matches. Generic labels such as "Dia 1" remain manual.
 */
export function findWorkoutDayIndexForDate(days, date = new Date()) {
  if (!Array.isArray(days) || days.length === 0) return -1
  const weekdayIndex = getLocalWeekdayIndex(date)
  if (weekdayIndex < 0) return -1

  const weekdayRoot = WEEKDAY_ROOTS[weekdayIndex]
  if (!weekdayRoot) return -1

  const matches = []
  days.forEach((day, index) => {
    const label = normalizeWeekdayLabel(day?.day)
    if (!label) return
    const paddedLabel = ` ${label} `
    if (paddedLabel.includes(` ${weekdayRoot} `)) matches.push(index)
  })

  return matches.length === 1 ? matches[0] : -1
}
