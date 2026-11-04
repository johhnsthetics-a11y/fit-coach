// Price amounts and ISO currency come from StoreKit. Brazil reference values
// are used only to block a mismatched quote, never to invent a displayed charge.
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
    const priceConfirmed = Boolean(product && rawDisplayPrice && amountConfirmed && currencyCode
      && !regionCurrencyMismatch && !recurringPriceMismatch)
    const offer = getIosIntroOffer(product, { locale })
    const monthlyPlan = detail.planId === 'mensal'
    const introAmount = normalizeStoreKitAmount(offer.amount)
    const expectedIntroAmount = normalizeStoreKitAmount(IOS_BRAZIL_PLAN_PRICE_REFERENCE.mensal.introductoryAmount)
    const introductoryPriceMismatch = brazilPricingExpected && monthlyPlan && offer.eligibility === 'eligible'
      && offer.paymentMode !== 'freeTrial'
      && currencyCode === 'BRL' && introAmount !== expectedIntroAmount
    const validAppleIntro = Boolean(priceConfirmed && offer.price && introAmount
      && (!brazilPricingExpected || currencyCode === 'BRL'))
    const showIntro = monthlyPlan && offer.showIntro && validAppleIntro && !introductoryPriceMismatch
    const standardPrice = priceConfirmed
      ? formatStoreKitPrice(amount, currencyCode, locale) : rawDisplayPrice ? 'Preço não confirmado' : 'Preço indisponível'
    const displayPrice = showIntro ? offer.price : standardPrice
    let purchaseBlockReason = ''
    if (!product || !rawDisplayPrice || !amountConfirmed) purchaseBlockReason = 'A Apple ainda não carregou um preço estruturado para este ciclo. Atualize os planos antes de assinar.'
    else if (!currencyCode) purchaseBlockReason = 'A moeda retornada pela App Store não pôde ser confirmada. Nenhuma compra será iniciada com um valor incerto.'
    else if (regionCurrencyMismatch) purchaseBlockReason = 'A loja Apple desta conta está em outra moeda. Para manter os valores em reais e evitar divergência na cobrança, use uma conta Apple configurada para a loja do Brasil.'
    else if (recurringPriceMismatch) purchaseBlockReason = `O preço da App Store diverge do valor esperado para a loja brasileira (${IOS_BRAZIL_PLAN_PRICE_REFERENCE[detail.planId].recurringPrice}). A compra fica bloqueada até corrigir o preço no App Store Connect.`
    else if (offer.available && offer.eligibility === 'unknown') purchaseBlockReason = 'A Apple ainda não confirmou as condições deste plano. Atualize os preços antes de assinar.'
    else if (introductoryPriceMismatch) purchaseBlockReason = `O preço introdutório da App Store diverge do valor esperado (${IOS_BRAZIL_PLAN_PRICE_REFERENCE.mensal.introductoryPrice}). A compra fica bloqueada até corrigir a oferta no App Store Connect.`
    else if (offer.available && offer.eligibility === 'eligible' && (!monthlyPlan || !offer.complete || !validAppleIntro)) {
      purchaseBlockReason = 'A Apple sinalizou uma condição promocional, mas não forneceu todos os termos para conferir o valor. Nenhuma compra será iniciada.'
    }
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
      introductoryPeriod: showIntro ? offer.totalPeriod : '',
      introAppliedToDisplay: showIntro,
    }
  })
}
