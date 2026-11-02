// Pricing is provided by Apple's StoreKit. Never convert or fabricate BRL amounts.
// The StoreKit purchase sheet is authoritative for the actual amount charged.
export const IOS_PLAN_DETAILS = Object.freeze([
  { planId: 'mensal', title: 'Mensal', cycleLabel: 'Renovação mensal' },
  { planId: 'semestral', title: 'Semestral', cycleLabel: 'Renovação semestral' },
  { planId: 'anual', title: 'Anual', cycleLabel: 'Renovação anual' },
])

const looksLikeUSD = (price) => /(?:\bUSD\b|\bUS\$|^\s*\$\s*\d)/i.test(price)

// Language/region are a display preference, NOT proof of the user's App Store storefront.
// When the local interface is Brazilian but StoreKit unexpectedly returns USD,
// omit the potentially misleading numeric price and ask the user to verify the
// official Apple purchase sheet before authorizing payment.
export function buildIosSubscriptionCards(products = [], options = {}) {
  const locale = String(options.locale || '').replace('_', '-')
  const brazilianDisplayLocale = /^pt-BR$/i.test(locale)
  const byPlan = new Map(
    (Array.isArray(products) ? products : [])
      .filter((product) => product && typeof product.planId === 'string')
      .map((product) => [product.planId, product]),
  )
  return IOS_PLAN_DETAILS.map((detail) => {
    const product = byPlan.get(detail.planId)
    const price = typeof product?.displayPrice === 'string' ? product.displayPrice.trim() : ''
    const currencyMismatch = brazilianDisplayLocale && looksLikeUSD(price)
    return {
      ...detail,
      available: Boolean(product && price),
      displayPrice: currencyMismatch
        ? 'Consulte o valor em reais na App Store'
        : (price || 'Preço indisponível'),
      currencyMismatch,
      // Do not advertise an introductory offer without verifying eligibility.
      introductoryDisplayPrice: null,
    }
  })
}
