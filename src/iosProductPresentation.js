// StoreKit supplies the authoritative checkout prices. Brazilian marketing prices
// are owner-provided references only, not converted USD or guaranteed charges.
import { IOS_BRAZIL_PLAN_PRICE_REFERENCE } from './iosBrazilPlanPriceReference.js'

export const IOS_PLAN_DETAILS = Object.freeze([
  { planId: 'mensal', title: 'Mensal', cycleLabel: 'Renovação mensal' },
  { planId: 'semestral', title: 'Semestral', cycleLabel: 'Renovação semestral' },
  { planId: 'anual', title: 'Anual', cycleLabel: 'Renovação anual' },
])

const ISO_CURRENCY = /^[A-Z]{3}$/i
// StoreKit uses ISO alpha-3 (BRA); older bridge/test data may use alpha-2 (BR).
const ISO_COUNTRY = /^(?:[A-Z]{2}|[A-Z]{3})$/i

export function normalizeIosStorefrontCountryCode(value) {
  const country = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return ISO_COUNTRY.test(country) ? country : ''
}

export function resolveIosPricingLocale(appLocale = '') {
  // This panel follows the app's HTML language, not the iPhone's preferred
  // language. The shipped interface is Brazilian Portuguese even on an
  // English-language device. A missing/generic Portuguese app locale is pt-BR.
  const locale = String(appLocale || 'pt-BR').trim().replaceAll('_', '-')
  if (/^pt$/i.test(locale)) return 'pt-BR'
  try {
    return Intl.getCanonicalLocales(locale)[0] || 'pt-BR'
  } catch {
    return 'pt-BR'
  }
}

function displayedCurrency(price) {
  // Inspect a normalized copy; never rewrite Apple's actual price string.
  const text = price.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[\u00a0\u202f]/g, ' ').trim()
  if (/US\s*\$|(?:^|[^A-Z])USD(?:$|[^A-Z])/i.test(text)) return 'USD'
  if (/R\s*\$|(?:^|[^A-Z])BRL(?:$|[^A-Z])/i.test(text)) return 'BRL'
  if (text.includes('€')) return 'EUR'
  if (text.includes('£')) return 'GBP'
  return ''
}

export function buildIosSubscriptionCards(products = [], options = {}) {
  const locale = options.locale ? resolveIosPricingLocale(options.locale) : ''
  const brazilianInterface = /^pt-BR(?:-|$)/i.test(locale)
  const byPlan = new Map(
    (Array.isArray(products) ? products : [])
      .filter((product) => product && typeof product.planId === 'string')
      .map((product) => [product.planId, product]),
  )

  return IOS_PLAN_DETAILS.map((detail) => {
    const product = byPlan.get(detail.planId)
    const rawPrice = typeof product?.displayPrice === 'string' ? product.displayPrice.trim() : ''
    const priceCurrencyCode = displayedCurrency(rawPrice)
    const currencyCode = typeof product?.currencyCode === 'string' && ISO_CURRENCY.test(product.currencyCode.trim())
      ? product.currencyCode.trim().toUpperCase()
      : priceCurrencyCode
    const storefrontCountryCode = normalizeIosStorefrontCountryCode(product?.storefrontCountryCode)
    const brazilianStorefront = ['BR', 'BRA'].includes(storefrontCountryCode)

    // The UI language cannot select a storefront or convert Apple's price.
    // TestFlight may return USD metadata while the purchase sheet uses BRL.
    // In that case show an honest confirmation prompt, never a guessed amount.
    const storefrontConflict = brazilianStorefront && currencyCode !== '' && currencyCode !== 'BRL'
    const textMetadataConflict = priceCurrencyCode !== '' && currencyCode !== '' && priceCurrencyCode !== currencyCode
    const foreignInterfacePrice = brazilianInterface && currencyCode !== '' && currencyCode !== 'BRL'
    const ambiguousDollar = (brazilianInterface || brazilianStorefront)
      && rawPrice.includes('$') && priceCurrencyCode !== 'BRL' && currencyCode === ''
    const mislabeledReal = currencyCode === 'BRL' && rawPrice.includes('$') && priceCurrencyCode !== 'BRL'
    const currencyMismatch = Boolean(rawPrice)
      && (storefrontConflict || textMetadataConflict || foreignInterfacePrice || ambiguousDollar || mislabeledReal)

    const brazilReference = brazilianInterface ? IOS_BRAZIL_PLAN_PRICE_REFERENCE[detail.planId] : null
    const validAppleBRL = Boolean(rawPrice && currencyCode === 'BRL'
      && priceCurrencyCode === 'BRL' && !currencyMismatch)
    const appleIntro = typeof product?.introductoryDisplayPrice === 'string'
      ? product.introductoryDisplayPrice.trim() : ''
    const validAppleIntro = Boolean(validAppleBRL && displayedCurrency(appleIntro) === 'BRL')

    // The owner has provided the BR subscription catalog for marketing display.
    // Prefer a consistent real StoreKit BRL price whenever available. When
    // TestFlight returns USD, show clearly labeled Brazilian reference prices,
    // never a converted or relabeled USD amount. Final Apple sheet is binding.
    const monthlyPromo = detail.planId === 'mensal' && Boolean(brazilReference)
    const referencePriceUsed = Boolean(brazilReference && (monthlyPromo
      ? !validAppleIntro : !validAppleBRL))
    const displayPrice = brazilReference
      ? (monthlyPromo
        ? (validAppleIntro ? appleIntro : brazilReference.introductoryPrice)
        : (validAppleBRL ? rawPrice : brazilReference.recurringPrice))
      : (currencyMismatch ? 'Confira o preço na App Store' : (rawPrice || 'Preço indisponível'))
    const renewalPrice = monthlyPromo
      ? (validAppleBRL ? rawPrice : brazilReference.recurringPrice) : ''

    return {
      ...detail,
      available: Boolean(product && rawPrice),
      currencyCode,
      storefrontCountryCode,
      currencyMismatch,
      referencePriceUsed,
      displayPrice,
      pricePeriod: brazilReference?.periodLabel || '',
      priceDescription: monthlyPromo
        ? brazilReference.promoDescription : (brazilReference?.renewalLabel || ''),
      renewalText: monthlyPromo ? `Depois, ${renewalPrice}/mês` : '',
      // Do not imply an introductory offer is guaranteed for this account.
      introductoryDisplayPrice: validAppleIntro ? appleIntro : null,
    }
  })
}
