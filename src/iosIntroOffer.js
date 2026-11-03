// StoreKit is the authority for offer availability, eligibility, duration and price.
// App login/account age and marketing prices never grant an Apple discount.
const units = { day: ['dia', 'dias'], week: ['semana', 'semanas'], month: ['mês', 'meses'], year: ['ano', 'anos'] }
const modes = new Set(['payAsYouGo', 'payUpFront', 'freeTrial'])
const text = value => typeof value === 'string' ? value.trim() : ''

export function describeApplePeriod(value, unit) {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 1 || !units[unit]) return ''
  return `${count} ${units[unit][count === 1 ? 0 : 1]}`
}

export function getIosIntroOffer(product) {
  const available = product?.introductoryOfferAvailable === true
  const eligibility = available
    ? product?.introductoryOfferEligible === true ? 'eligible'
      : product?.introductoryOfferEligible === false ? 'ineligible' : 'unknown'
    : 'unknown'
  const status = available ? eligibility : product ? 'unavailable' : 'loading'
  const price = text(product?.introductoryDisplayPrice)
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
    periodValue: value, periodUnit: unit, periodCount: count, terms,
    showIntro: eligibility === 'eligible' && complete }
}

// Compare only offer terms natively before presenting payment. This is not an
// eligibility override or a request to change Apple's charge.
export function getIosPurchaseOfferExpectation(product) {
  if (!product) return undefined
  const offer = getIosIntroOffer(product)
  return {
    available: offer.available,
    eligible: product.introductoryOfferEligible === true,
    displayPrice: offer.price,
    paymentMode: offer.paymentMode,
    periodValue: Number.isSafeInteger(offer.periodValue) ? offer.periodValue : 0,
    periodUnit: offer.periodUnit,
    periodCount: Number.isSafeInteger(offer.periodCount) ? offer.periodCount : 0,
  }
}
