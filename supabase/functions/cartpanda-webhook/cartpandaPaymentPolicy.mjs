export function parseAllowedIds(value = '') {
  return new Set(String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean))
}

export function parseAllowedCents(value = '') {
  return new Set(String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0))
}

export function validateStudentPayment(payment, config) {
  if (!config.productIds?.size || !config.amounts?.size) {
    return { ok: false, reason: 'configuration_missing' }
  }
  if (!String(payment.orderId || '').trim()) return { ok: false, reason: 'order_missing' }
  if (!config.productIds.has(String(payment.productId || '').trim())) {
    return { ok: false, reason: 'product_mismatch' }
  }
  if (!config.amounts.has(Number(payment.amountCents))) {
    return { ok: false, reason: 'amount_mismatch' }
  }
  return { ok: true, reason: '' }
}

export function mapCartpandaSubscriptionStatus(eventType, payload = {}) {
  const haystack = [
    eventType,
    findNestedValue(payload, ['order_type', 'payment_status', 'status', 'transaction_status', 'subscription_status', 'financial_status']),
  ].join(' ').toLowerCase()

  if (/(chargeback|contest|dispute)/.test(haystack)) return 'chargeback'
  if (/(refund|reembolso|refunded|estorno)/.test(haystack)) return 'refunded'
  if (/(cancel|canceled|cancelado|cancelled)/.test(haystack)) return 'canceled'
  if (/(fail|failed|recus|declin|denied|overdue|past_due|atras|unpaid)/.test(haystack)) return 'past_due'
  if (/(paid|approved|aprov|complete|completed|active|confirm|captured|sale|order)/.test(haystack)) return 'active'

  const hasSaleSignals = Boolean(
    findNestedValue(payload, ['order_id', 'id', 'transaction_id'])
    && findNestedValue(payload, ['email', 'buyer_email', 'customer_email'])
    && findNestedValue(payload, ['product_id', 'product_name'])
  )

  return hasSaleSignals ? 'active' : 'pending'
}

export function isConfirmedCartpandaPayment(eventType, payload = {}) {
  const haystack = [
    eventType,
    findNestedValue(payload, ['order_type', 'payment_status', 'transaction_status', 'financial_status', 'subscription_status', 'status']),
  ].join(' ').toLowerCase()
  return /(paid|approved|aprov|complete|completed|active|confirm|captured|initial_sale)/.test(haystack)
}

function findNestedValue(source, preferredKeys) {
  if (!source || typeof source !== 'object') return ''
  const normalizedKeys = new Map(Object.keys(source).map((key) => [normalizePolicyKey(key), key]))

  for (const key of preferredKeys) {
    const realKey = normalizedKeys.get(normalizePolicyKey(key))
    if (realKey && source[realKey] != null && source[realKey] !== '') return String(source[realKey]).trim()
  }

  for (const value of Object.values(source)) {
    const nested = findNestedValue(value, preferredKeys)
    if (nested) return nested
  }

  return ''
}

function normalizePolicyKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
