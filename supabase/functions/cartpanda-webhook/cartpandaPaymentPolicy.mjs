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
