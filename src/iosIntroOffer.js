// StoreKit is the authority for offer availability, eligibility, duration and price.
// App login/account age and marketing references never grant an Apple discount.
import { formatStoreKitPrice } from './iosStoreKitPrice.js'

const units = { day: ['dia', 'dias'], week: ['semana', 'semanas'], month: ['mês', 'meses'], year: ['ano', 'anos'] }
const modes = new Set(['payAsYouGo', 'payUpFront', 'freeTrial'])
const text = value => typeof value === 'string' ? value.trim() : ''

export function describeApplePeriod(value, unit) {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 1 || !units[unit]) return ''
  return `${count} ${units[unit][count === 1 ? 0 : 1]}`
}

export function getIosIntroOffer(product, options = {}) {
  const available = product?.introductoryOfferAvailable === true
  const eligibility = available
    ? product?.introductoryOfferEligible === true ? 'eligible'
      : product?.introductoryOfferEligible === false ? 'ineligible' : 'unknown'
    : 'unknown'
  const status = available ? eligibility : product ? 'unavailable' : 'loading'
  const currencyCode = text(product?.currencyCode).toUpperCase()
  const formattedAmount = formatStoreKitPrice(product?.introductoryPriceAmount, currencyCode, options.locale || 'pt-BR')
  const price = formattedAmount || text(product?.introductoryDisplayPrice)
  const paymentMode = text(product?.introductoryPaymentMode)
  const value = Number(product?.introductoryPeriodValue)
  const unit = text(product?.introductoryPeriodUnit)
  const count = Number(product?.introductoryPeriodCount)
  const period = describeApplePeriod(value, unit)
  const totalPeriod = Number.isSafeInteger(count) && count > 0 ? describeApplePeriod(value * count, unit) : ''
  const complete = Boolean(price && period && totalPeriod && modes.has(paymentMode))
  let terms = ''
  if (complete) {
    terms = paymentMode === 'freeTrial' ? `Teste gratuito por ${totalPeriod}`
      : paymentMode === 'payUpFront' ? `${price} pelo período inicial de ${totalPeriod}`
        : count === 1 ? `${price} pelo período inicial de ${period}`
          : `${price} a cada ${period}, durante ${totalPeriod}`
  }
  return { status, eligibility, available, complete, price, paymentMode, period, totalPeriod,
    amount: text(product?.introductoryPriceAmount), periodValue: value, periodUnit: unit, periodCount: count, terms,
    showIntro: eligibility === 'eligible' && complete }
}

// Snapshot of the exact structured Apple quote presented in the UI. The native
// bridge compares amounts/currency/period/eligibility with a fresh StoreKit Product.
export function getIosPurchaseTermsExpectation(product) {
  if (!product || typeof product.displayPrice !== 'string') return null
  const safeCount = value => {
    const number = Number(value)
    return Number.isSafeInteger(number) && number > 0 ? number : 0
  }
  const hasOffer = product.introductoryOfferAvailable === true
  return {
    id: text(product.id),
    displayPrice: text(product.displayPrice),
    priceAmount: text(product.priceAmount),
    currencyCode: text(product.currencyCode).toUpperCase(),
    storefrontCountryCode: text(product.storefrontCountryCode).toUpperCase(),
    subscriptionPeriodValue: safeCount(product.subscriptionPeriodValue),
    subscriptionPeriodUnit: text(product.subscriptionPeriodUnit),
    introductoryOfferAvailable: hasOffer,
    introductoryOfferEligible: hasOffer && product.introductoryOfferEligible === true,
    introductoryDisplayPrice: hasOffer ? text(product.introductoryDisplayPrice) : '',
    introductoryPriceAmount: hasOffer ? text(product.introductoryPriceAmount) : '',
    introductoryPaymentMode: hasOffer ? text(product.introductoryPaymentMode) : '',
    introductoryPeriodValue: hasOffer ? safeCount(product.introductoryPeriodValue) : 0,
    introductoryPeriodUnit: hasOffer ? text(product.introductoryPeriodUnit) : '',
    introductoryPeriodCount: hasOffer ? safeCount(product.introductoryPeriodCount) : 0,
  }
}
