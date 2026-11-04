const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/
const CURRENCY_PATTERN = /^[A-Z]{3}$/

export function normalizeStoreKitAmount(value) {
  const raw = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
  if (!AMOUNT_PATTERN.test(raw)) return ''
  const [wholePart, fractionPart = ''] = raw.split('.')
  if (/[1-9]/.test(fractionPart.slice(2))) return ''
  try {
    const whole = BigInt(wholePart).toString()
    const fraction = (fractionPart + '00').slice(0, 2)
    return `${whole}.${fraction}`
  } catch { return '' }
}

export function formatStoreKitPrice(amount, currencyCode, locale = 'pt-BR') {
  const raw = typeof amount === 'string' ? amount.trim() : typeof amount === 'number' ? String(amount) : ''
  const currency = typeof currencyCode === 'string' ? currencyCode.trim().toUpperCase() : ''
  if (!AMOUNT_PATTERN.test(raw) || !CURRENCY_PATTERN.test(currency)) return ''
  const numericAmount = Number(raw)
  if (!Number.isFinite(numericAmount) || numericAmount < 0 || numericAmount > 1e12) return ''
  let resolvedLocale = 'pt-BR'
  try { resolvedLocale = Intl.getCanonicalLocales(String(locale || 'pt-BR').replaceAll('_', '-'))[0] || 'pt-BR' }
  catch { /* Use the Brazilian Portuguese app locale for a safe display fallback. */ }
  try {
    return new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency }).format(numericAmount)
  } catch { return '' }
}
