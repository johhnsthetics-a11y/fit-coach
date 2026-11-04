// The Brazilian catalog uses the original reais amounts. StoreKit metadata
// stays unchanged; Apple controls the final purchase sheet and charge.
import { IOS_BRAZIL_PLAN_PRICE_REFERENCE } from './iosBrazilPlanPriceReference.js'
import { getIosIntroOffer } from './iosIntroOffer.js'
import { formatStoreKitPrice, normalizeStoreKitAmount } from './iosStoreKitPrice.js'

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

export function buildIosSubscriptionCards(products = [], options = {}) {
  const locale = options.locale ? resolveIosPricingLocale(options.locale) : 'pt-BR'
  const brazilianInterface = /^pt-BR(?:-|$)/i.test(locale)
  const byPlan = new Map((Array.isArray(products) ? products : [])
    .filter(product => product && typeof product.planId === 'string')
    .map(product => [product.planId, product]))
  return IOS_PLAN_DETAILS.map(detail => {
    const product = byPlan.get(detail.planId)
    const rawDisplayPrice = typeof product?.displayPrice === 'string' ? product.displayPrice.trim() : ''
    const amount = normalizeStoreKitAmount(product?.priceAmount)
    const rawCurrency = typeof product?.currencyCode === 'string' ? product.currencyCode.trim() : ''
    const currencyCode = ISO_CURRENCY.test(rawCurrency) ? rawCurrency.toUpperCase() : ''
    const storefrontCountryCode = normalizeIosStorefrontCountryCode(product?.storefrontCountryCode)
    const brazilianStorefront = ['BR', 'BRA'].includes(storefrontCountryCode)
    const brazilPricingExpected = brazilianInterface || brazilianStorefront
    const regionCurrencyMismatch = brazilPricingExpected && currencyCode !== 'BRL'
    const expectedAmount = IOS_BRAZIL_PLAN_PRICE_REFERENCE[detail.planId]?.recurringAmount || ''
    const recurringPriceMismatch = brazilPricingExpected && currencyCode === 'BRL'
      && amount !== normalizeStoreKitAmount(expectedAmount)
    const amountConfirmed = Boolean(amount && Number(amount) > 0)
    const priceConfirmed = Boolean(product && rawDisplayPrice && amountConfirmed && currencyCode)
    const offer = getIosIntroOffer(product, { locale })
    const monthlyPlan = detail.planId === 'mensal'
    const introAmount = normalizeStoreKitAmount(offer.amount)
    const expectedIntroAmount = normalizeStoreKitAmount(IOS_BRAZIL_PLAN_PRICE_REFERENCE.mensal.introductoryAmount)
    const introductoryPriceMismatch = brazilPricingExpected && monthlyPlan && offer.available
      && offer.paymentMode !== 'freeTrial'
      && currencyCode === 'BRL' && introAmount !== expectedIntroAmount
    const validAppleIntro = Boolean(priceConfirmed && offer.price && introAmount
      && (!brazilPricingExpected || (currencyCode === 'BRL' && !introductoryPriceMismatch)))
    const showIntro = monthlyPlan && offer.showIntro && validAppleIntro
    const standardPrice = !product || !rawDisplayPrice ? 'Preço indisponível' : brazilPricingExpected
      ? IOS_BRAZIL_PLAN_PRICE_REFERENCE[detail.planId].recurringPrice
      : priceConfirmed ? formatStoreKitPrice(amount, currencyCode, locale) : rawDisplayPrice || 'Preço indisponível'
    const displayPrice = showIntro ? offer.price : standardPrice
    const purchaseBlockReason = product && rawDisplayPrice ? ''
      : 'Este ciclo não foi carregado pela App Store. Atualize os planos antes de assinar.'
    const priceDescription = monthlyPlan
      ? (showIntro ? offer.terms : detail.cycleLabel)
      : detail.cycleLabel
    return {
      ...detail, available: Boolean(product && rawDisplayPrice), purchaseAvailable: !purchaseBlockReason,
      purchaseBlockReason, currencyCode, storefrontCountryCode, currencyMismatch: regionCurrencyMismatch,
      recurringPriceMismatch, introductoryPriceMismatch,
      introEligibility: monthlyPlan ? offer.eligibility : 'unknown',
      introStatus: monthlyPlan ? offer.status : 'unavailable',
      introductoryOfferAvailable: offer.available,
      displayPrice, standardPrice, pricePeriod: '', priceDescription,
      renewalText: showIntro ? `Depois, ${standardPrice}/mês` : '',
      introductoryDisplayPrice: showIntro ? offer.price : null,
      introductoryTerms: showIntro ? offer.terms : '',
      introEligibilityNotice: showIntro ? offer.eligibilityNotice : '',
      introductoryPeriod: showIntro ? offer.totalPeriod : '',
      introAppliedToDisplay: showIntro,
    }
  })
}
