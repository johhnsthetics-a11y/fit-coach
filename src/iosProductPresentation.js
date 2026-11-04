// The UI displays only current StoreKit price/offer terms; marketing references
// are never substituted for the amount and currency Apple will bill.
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
    const ambiguousDollar = (brazilianInterface || brazilianStorefront) && rawPrice.includes('$') && priceCurrencyCode !== 'BRL' && currencyCode === ''
    const mislabeledReal = currencyCode === 'BRL' && rawPrice.includes('$') && priceCurrencyCode !== 'BRL'
    const currencyMismatch = Boolean(rawPrice) && (storefrontConflict || textMetadataConflict || ambiguousDollar || mislabeledReal)
    const priceConfirmed = Boolean(product && rawPrice && currencyCode && !currencyMismatch)
    const offer = getIosIntroOffer(product)
    const monthlyPlan = detail.planId === 'mensal'
    const introCurrency = displayedCurrency(offer.price)
    const validAppleIntro = Boolean(priceConfirmed && offer.price && (!introCurrency || introCurrency === currencyCode))
    const showIntro = monthlyPlan && offer.showIntro && validAppleIntro
    const standardPrice = priceConfirmed ? rawPrice : rawPrice ? 'Preço não confirmado' : 'Preço indisponível'
    const displayPrice = showIntro ? offer.price : standardPrice
    let purchaseBlockReason = ''
    if (!product || !rawPrice) purchaseBlockReason = 'A Apple ainda não carregou o preço deste ciclo. Atualize os planos antes de assinar.'
    else if (!currencyCode || currencyMismatch) purchaseBlockReason = 'A moeda ou o preço retornado pela App Store não pôde ser confirmado. Nenhuma compra será iniciada com um valor incerto.'
    else if (offer.available && offer.eligibility === 'unknown') purchaseBlockReason = 'A Apple ainda não confirmou as condições deste plano. Atualize os preços antes de assinar.'
    else if (offer.available && offer.eligibility === 'eligible' && (!monthlyPlan || !offer.complete || !validAppleIntro)) {
      purchaseBlockReason = 'A Apple sinalizou uma condição promocional, mas não forneceu todos os termos para conferir o valor. Nenhuma compra será iniciada.'
    }
    const priceDescription = monthlyPlan
      ? (showIntro ? offer.terms : detail.cycleLabel)
      : detail.cycleLabel
    return {
      ...detail, available: Boolean(product && rawPrice), purchaseAvailable: !purchaseBlockReason,
      purchaseBlockReason, currencyCode, storefrontCountryCode, currencyMismatch,
      introEligibility: monthlyPlan ? offer.eligibility : 'unknown',
      introStatus: monthlyPlan ? offer.status : 'unavailable',
      introductoryOfferAvailable: offer.available,
      displayPrice, standardPrice, pricePeriod: '', priceDescription,
      renewalText: showIntro ? `Depois, ${standardPrice}/mês` : '',
      introductoryDisplayPrice: showIntro ? offer.price : null,
      introductoryTerms: showIntro ? offer.terms : '',
      introductoryPeriod: showIntro ? offer.totalPeriod : '',
      introAppliedToDisplay: showIntro,
    }
  })
}
