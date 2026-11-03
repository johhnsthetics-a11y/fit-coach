// StoreKit supplies the authoritative checkout prices. Brazilian marketing prices
// are owner-provided references only, not converted USD or guaranteed charges.
import { IOS_BRAZIL_PLAN_PRICE_REFERENCE } from './iosBrazilPlanPriceReference.js'
import { getIosIntroOffer } from './iosIntroOffer.js'

export const IOS_PLAN_DETAILS = Object.freeze([
  { planId: 'mensal', title: 'Mensal', cycleLabel: 'Renovação mensal' },
  { planId: 'semestral', title: 'Semestral', cycleLabel: 'Renovação semestral' },
  { planId: 'anual', title: 'Anual', cycleLabel: 'Renovação anual' },
])

const ISO_CURRENCY = /^[A-Z]{3}$/i
const ISO_COUNTRY = /^(?:[A-Z]{2}|[A-Z]{3})$/i

export function normalizeIosStorefrontCountryCode(value) {
  const country = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return ISO_COUNTRY.test(country) ? country : ''
}

export function resolveIosPricingLocale(appLocale = '') {
  const locale = String(appLocale || 'pt-BR').trim().replaceAll('_', '-')
  if (/^pt$/i.test(locale)) return 'pt-BR'
  try { return Intl.getCanonicalLocales(locale)[0] || 'pt-BR' }
  catch { return 'pt-BR' }
}

function displayedCurrency(price) {
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
  const byPlan = new Map((Array.isArray(products) ? products : [])
    .filter(product => product && typeof product.planId === 'string')
    .map(product => [product.planId, product]))
  return IOS_PLAN_DETAILS.map(detail => {
    const product = byPlan.get(detail.planId)
    const rawPrice = typeof product?.displayPrice === 'string' ? product.displayPrice.trim() : ''
    const priceCurrencyCode = displayedCurrency(rawPrice)
    const currencyCode = typeof product?.currencyCode === 'string' && ISO_CURRENCY.test(product.currencyCode.trim())
      ? product.currencyCode.trim().toUpperCase() : priceCurrencyCode
    const storefrontCountryCode = normalizeIosStorefrontCountryCode(product?.storefrontCountryCode)
    const brazilianStorefront = ['BR', 'BRA'].includes(storefrontCountryCode)
    const storefrontConflict = brazilianStorefront && currencyCode !== '' && currencyCode !== 'BRL'
    const textMetadataConflict = priceCurrencyCode !== '' && currencyCode !== '' && priceCurrencyCode !== currencyCode
    const foreignInterfacePrice = brazilianInterface && currencyCode !== '' && currencyCode !== 'BRL'
    const ambiguousDollar = (brazilianInterface || brazilianStorefront) && rawPrice.includes('$') && priceCurrencyCode !== 'BRL' && currencyCode === ''
    const mislabeledReal = currencyCode === 'BRL' && rawPrice.includes('$') && priceCurrencyCode !== 'BRL'
    const currencyMismatch = Boolean(rawPrice) && (storefrontConflict || textMetadataConflict || foreignInterfacePrice || ambiguousDollar || mislabeledReal)
    const brazilReference = brazilianInterface ? IOS_BRAZIL_PLAN_PRICE_REFERENCE[detail.planId] : null
    const validAppleBRL = Boolean(rawPrice && currencyCode === 'BRL' && priceCurrencyCode === 'BRL' && !currencyMismatch)
    const offer = getIosIntroOffer(product)
    const monthlyPlan = detail.planId === 'mensal'
    const introCurrency = displayedCurrency(offer.price)
    const validAppleIntro = Boolean(rawPrice && !currencyMismatch && offer.price
      && (currencyCode === 'BRL' ? introCurrency === 'BRL' : currencyCode && (!introCurrency || introCurrency === currencyCode)))
    const showIntro = monthlyPlan && offer.showIntro && validAppleIntro
    const standardPrice = brazilReference ? (validAppleBRL ? rawPrice : brazilReference.recurringPrice)
      : (currencyMismatch ? 'Confira o preço na App Store' : (rawPrice || 'Preço indisponível'))
    const referencePriceUsed = Boolean(brazilReference && !validAppleBRL)
    const displayPrice = showIntro ? offer.price : standardPrice
    // Only disclose introductory terms when StoreKit confirmed an eligible,
    // complete offer. Otherwise display the regular billing cycle normally.
    const priceDescription = monthlyPlan
      ? (showIntro ? offer.terms : detail.cycleLabel)
      : (brazilReference?.renewalLabel || detail.cycleLabel)
    return {
      ...detail, available: Boolean(product && rawPrice), currencyCode, storefrontCountryCode,
      currencyMismatch, referencePriceUsed,
      introEligibility: monthlyPlan ? offer.eligibility : 'unknown',
      introStatus: monthlyPlan ? offer.status : 'unavailable',
      introductoryOfferAvailable: offer.available,
      displayPrice, standardPrice, pricePeriod: brazilReference?.periodLabel || '', priceDescription,
      renewalText: showIntro ? `Depois, ${standardPrice}/mês` : '',
      introductoryDisplayPrice: showIntro ? offer.price : null,
      introductoryTerms: showIntro ? offer.terms : '',
      introductoryPeriod: showIntro ? offer.totalPeriod : '',
      introAppliedToDisplay: showIntro,
    }
  })
}
