const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active', 'paid', 'em dia', 'em_dia', 'trialing', 'approved', 'aprovado',
  'authorized', 'autorizado', 'completed', 'complete', 'ativo',
])

export function normalizeBillingCycle(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized.includes('semana')) return 'semanal'
  if (normalized.includes('semestre') || normalized.includes('semes') || normalized.includes('6 mes')) return 'semestral'
  if (normalized.includes('ano') || normalized.includes('anual') || normalized.includes('12 mes')) return 'anual'
  return 'mensal'
}

export function addBillingCycle(value, cycle) {
  const parts = String(value || '').slice(0, 10).split('-').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return ''
  const [year, month, day] = parts
  const normalizedCycle = normalizeBillingCycle(cycle)

  if (normalizedCycle === 'semanal') {
    const date = new Date(Date.UTC(year, month - 1, day + 7))
    return date.toISOString().slice(0, 10)
  }

  const monthsToAdd = normalizedCycle === 'semestral' ? 6 : normalizedCycle === 'anual' ? 12 : 1
  const targetMonthIndex = month - 1 + monthsToAdd
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

export function buildStudentAccessUrl(appUrl, inviteCode) {
  const token = String(inviteCode || '').trim()
  if (!token) return ''
  try {
    const url = new URL(appUrl)
    url.search = ''
    url.hash = ''
    url.searchParams.set('invite', token)
    return url.toString()
  } catch {
    return ''
  }
}

export function isSubscriptionCurrent(subscription, referenceTime = Date.now()) {
  const status = String(subscription?.status || '').trim().toLowerCase()
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(status)) return false
  if (!subscription?.currentPeriodEndsAt) return true
  const expiresAt = Date.parse(subscription.currentPeriodEndsAt)
  return Number.isFinite(expiresAt) && expiresAt > referenceTime
}
