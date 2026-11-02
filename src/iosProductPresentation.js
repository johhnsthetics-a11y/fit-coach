// Pricing shown in the native app must come exclusively from Apple's StoreKit products.
// Never fall back to Cartpanda/admin prices or display unverified introductory offers.
export const IOS_PLAN_DETAILS = Object.freeze([
  { planId: 'mensal', title: 'Mensal', cycleLabel: 'Renovação mensal' },
  { planId: 'semestral', title: 'Semestral', cycleLabel: 'Renovação semestral' },
  { planId: 'anual', title: 'Anual', cycleLabel: 'Renovação anual' },
])

export function buildIosSubscriptionCards(products = []) {
  const byPlan = new Map(
    (Array.isArray(products) ? products : [])
      .filter((product) => product && typeof product.planId === 'string')
      .map((product) => [product.planId, product]),
  )
  return IOS_PLAN_DETAILS.map((detail) => {
    const product = byPlan.get(detail.planId)
    const price = typeof product?.displayPrice === 'string' ? product.displayPrice.trim() : ''
    const currencyCode = typeof product?.currencyCode === 'string' && /^[A-Z]{3}$/i.test(product.currencyCode.trim())
      ? product.currencyCode.trim().toUpperCase()
      : /^US\$/.test(price) ? 'USD' : /^R\$/.test(price) ? 'BRL' : ''
    return {
      ...detail,
      available: Boolean(product && price),
      displayPrice: price || 'Preço indisponível',
      currencyCode,
      // An introductory offer cannot be advertised unless eligibility is checked.
      // The StoreKit purchase sheet remains authoritative about any actual offer.
      introductoryDisplayPrice: null,
    }
  })
}
