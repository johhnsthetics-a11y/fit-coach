// Native prices are provided by StoreKit. Never convert USD to BRL or
// hardcode subscription amounts: the Apple purchase sheet is authoritative.
export const IOS_PLAN_DETAILS = Object.freeze([
  { planId: 'mensal', title: 'Mensal', cycleLabel: 'Renovação mensal' },
  { planId: 'semestral', title: 'Semestral', cycleLabel: 'Renovação semestral' },
  { planId: 'anual', title: 'Anual', cycleLabel: 'Renovação anual' },
])

const ISO_CURRENCY = /^[A-Z]{3}$/i
const ISO_COUNTRY = /^[A-Z]{2}$/i

export function buildIosSubscriptionCards(products = [], options = {}) {
  const locale = String(options.locale || '').replace('_', '-')
  const brazilianInterface = /^pt-BR$/i.test(locale)
  const byPlan = new Map(
    (Array.isArray(products) ? products : [])
      .filter((product) => product && typeof product.planId === 'string')
      .map((product) => [product.planId, product]),
  )

  return IOS_PLAN_DETAILS.map((detail) => {
    const product = byPlan.get(detail.planId)
    const rawPrice = typeof product?.displayPrice === 'string' ? product.displayPrice.trim() : ''
    const currencyCode = typeof product?.currencyCode === 'string' && ISO_CURRENCY.test(product.currencyCode.trim())
      ? product.currencyCode.trim().toUpperCase()
      : /^US\$/.test(rawPrice) ? 'USD' : /^R\$/.test(rawPrice) ? 'BRL' : ''
    const storefrontCountryCode = typeof product?.storefrontCountryCode === 'string'
      && ISO_COUNTRY.test(product.storefrontCountryCode.trim())
      ? product.storefrontCountryCode.trim().toUpperCase() : ''

    // 'pt-BR' only identifies the app's UI locale, not the actual App Store
    // storefront. We flag inconsistent metadata without altering Apple's price.
    const storefrontConflict = storefrontCountryCode === 'BR' && currencyCode !== '' && currencyCode !== 'BRL'
    const currencyMismatch = Boolean(rawPrice)
      && (storefrontConflict || (brazilianInterface && currencyCode === 'USD'))

    return {
      ...detail,
      available: Boolean(product && rawPrice),
      currencyCode,
      storefrontCountryCode,
      currencyMismatch,
      displayPrice: currencyMismatch
        ? 'Confira o preço na App Store'
        : (rawPrice || 'Preço indisponível'),
      // Introductory offer eligibility varies; confirm it in the Apple sheet.
      introductoryDisplayPrice: null,
    }
  })
}
