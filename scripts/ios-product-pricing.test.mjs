import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIosSubscriptionCards, normalizeIosStorefrontCountryCode, resolveIosPricingLocale } from '../src/iosProductPresentation.js'
import { getIosIntroOffer, getIosPurchaseTermsExpectation, describeApplePeriod } from '../src/iosIntroOffer.js'
import { formatStoreKitPrice, normalizeStoreKitAmount } from '../src/iosStoreKitPrice.js'

const locale = { locale: 'pt-BR' }
const priceText = value => String(value || '').replace(/[\u00a0\u202f]/g, ' ')
const monthly = {
  id: 'br.com.coachfitpro.ios.profissional.mensal', planId: 'mensal',
  displayPrice: '$49.90', priceAmount: '49.90', currencyCode: 'BRL', storefrontCountryCode: 'BRA',
  subscriptionGroupId: 'demo-group', subscriptionPeriodValue: 1, subscriptionPeriodUnit: 'month',
  introductoryOfferAvailable: true, introductoryOfferEligible: true,
  introductoryDisplayPrice: '$9.90', introductoryPriceAmount: '9.90', introductoryPaymentMode: 'payAsYouGo',
  introductoryPeriodValue: 1, introductoryPeriodUnit: 'month', introductoryPeriodCount: 1,
}
const card = (overrides = {}, options = locale) => buildIosSubscriptionCards([{ ...monthly, ...overrides }], options)[0]

test('Brazil StoreKit decimal/currency formats a raw dollar displayPrice as R$ without changing charge', () => {
  const plan = card()
  assert.equal(priceText(plan.displayPrice), 'R$ 9,90')
  assert.equal(priceText(plan.standardPrice), 'R$ 49,90')
  assert.equal(priceText(plan.renewalText), 'Depois, R$ 49,90/mês')
  assert.equal(plan.currencyCode, 'BRL')
  assert.equal(plan.purchaseAvailable, true)
  assert.equal(priceText(plan.introductoryTerms), 'R$ 9,90 pelo período inicial de 1 mês')
})

test('An ineligible Apple Account sees the exact regular StoreKit price', () => {
  const plan = card({ introductoryOfferEligible: false })
  assert.equal(priceText(plan.displayPrice), 'R$ 49,90')
  assert.equal(plan.introEligibility, 'ineligible')
  assert.equal(plan.purchaseAvailable, true)
  assert.equal(plan.renewalText, '')
})

test('Unknown eligibility allows Apple to confirm the purchase terms', () => {
  const plan = card({ introductoryOfferEligible: undefined })
  assert.equal(priceText(plan.displayPrice), 'R$ 49,90')
  assert.equal(plan.introStatus, 'unknown')
  assert.equal(plan.purchaseAvailable, true)
  assert.equal(plan.purchaseBlockReason, '')
})

test('If no introductory offer exists, the current Apple price remains purchasable', () => {
  const plan = card({ introductoryOfferAvailable: false, introductoryOfferEligible: false })
  assert.equal(priceText(plan.displayPrice), 'R$ 49,90')
  assert.equal(plan.introStatus, 'unavailable')
  assert.equal(plan.purchaseAvailable, true)
})

test('Apple recurring price remains purchasable when the local reference differs', () => {
  const plan = card({ displayPrice: 'R$ 12,90', priceAmount: '12.90', introductoryOfferAvailable: false })
  assert.equal(priceText(plan.displayPrice), 'R$ 12,90')
  assert.equal(plan.recurringPriceMismatch, true)
  assert.equal(plan.purchaseAvailable, true)
  assert.equal(plan.purchaseBlockReason, '')
})

test('Apple storefront currency remains purchasable in a Portuguese interface', () => {
  const plan = card({ displayPrice: 'US$ 49.90', priceAmount: '49.90', introductoryDisplayPrice: 'US$ 9.90', currencyCode: 'USD', storefrontCountryCode: 'USA' })
  assert.equal(priceText(plan.displayPrice), 'US$ 9,90')
  assert.equal(plan.currencyMismatch, true)
  assert.equal(plan.purchaseAvailable, true)
  assert.match(plan.displayPrice, /US\$/)
})

test('Apple introductory amount is displayed without enforcing local reference', () => {
  const plan = card({ introductoryPriceAmount: '1.99', introductoryDisplayPrice: '$1.99' })
  assert.equal(priceText(plan.displayPrice), 'R$ 1,99')
  assert.equal(plan.introAppliedToDisplay, true)
  assert.equal(plan.introductoryPriceMismatch, true)
  assert.equal(plan.purchaseAvailable, true)
  assert.equal(plan.purchaseBlockReason, '')
})

test('Missing currency metadata preserves Apple display price and opens confirmation', () => {
  const plan = card({ displayPrice: '49.90', currencyCode: '', storefrontCountryCode: '' })
  assert.equal(plan.displayPrice, '49.90')
  assert.equal(plan.purchaseAvailable, true)
})

test('Incomplete offer terms do not block Apple purchase confirmation', () => {
  for (const override of [{ introductoryPeriodValue: undefined }, { introductoryPeriodUnit: '' }, { introductoryPeriodCount: 0 }, { introductoryPaymentMode: 'unknown' }]) {
    const plan = card({ introductoryOfferEligible: true, ...override })
    assert.equal(plan.introAppliedToDisplay, false)
    assert.equal(priceText(plan.displayPrice), 'R$ 49,90')
    assert.equal(plan.purchaseAvailable, true)
  }
})

test('Pay-up-front and free-trial terms stay explicit and use StoreKit amounts', () => {
  assert.match(priceText(getIosIntroOffer({ ...monthly, introductoryOfferEligible: true, introductoryPeriodCount: 3 }).terms), /a cada 1 mês, durante 3 meses/)
  assert.match(priceText(getIosIntroOffer({ ...monthly, introductoryOfferEligible: true, introductoryPaymentMode: 'payUpFront', introductoryPeriodValue: 2 }).terms), /pelo período inicial de 2 meses/)
  const trial = card({ introductoryOfferEligible: true, introductoryPriceAmount: '0.00', introductoryDisplayPrice: 'R$ 0,00', introductoryPaymentMode: 'freeTrial', introductoryPeriodValue: 7, introductoryPeriodUnit: 'day' })
  assert.equal(priceText(trial.displayPrice), 'R$ 0,00')
  assert.match(trial.introductoryTerms, /Teste gratuito por 7 dias/)
  assert.equal(priceText(trial.renewalText), 'Depois, R$ 49,90/mês')
  assert.equal(trial.purchaseAvailable, true)
})

test('Missing products have no price and cannot open purchase', () => {
  const cards = buildIosSubscriptionCards([], locale)
  assert.equal(cards[0].displayPrice, 'Preço indisponível')
  assert.equal(cards[0].introStatus, 'loading')
  assert.ok(cards.every(plan => !plan.available && !plan.purchaseAvailable))
})

test('Semestral and annual cards verify and format their requested Brazil amounts', () => {
  const cards = buildIosSubscriptionCards([
    { planId: 'semestral', displayPrice: '$239.90', priceAmount: '239.90', currencyCode: 'BRL', storefrontCountryCode: 'BRA' },
    { planId: 'anual', displayPrice: '$359.00', priceAmount: '359.00', currencyCode: 'BRL', storefrontCountryCode: 'BRA' },
  ], locale)
  assert.deepEqual(cards.slice(1).map(x => priceText(x.displayPrice)), ['R$ 239,90', 'R$ 359,00'])
  assert.ok(cards.slice(1).every(plan => plan.purchaseAvailable))
})

test('Purchase snapshot contains raw StoreKit amounts, currency, offer and storefront', () => {
  const terms = getIosPurchaseTermsExpectation(monthly)
  assert.equal(terms.id, monthly.id)
  assert.equal(terms.displayPrice, '$49.90')
  assert.equal(terms.priceAmount, '49.90')
  assert.equal(terms.currencyCode, 'BRL')
  assert.equal(terms.storefrontCountryCode, 'BRA')
  assert.equal(terms.introductoryOfferEligible, true)
  assert.equal(terms.introductoryDisplayPrice, '$9.90')
  assert.equal(terms.introductoryPriceAmount, '9.90')
  assert.equal(terms.introductoryPeriodCount, 1)
  assert.equal(getIosPurchaseTermsExpectation(null), null)
})

test('StoreKit money utilities reject malformed amounts/currencies and format BRL explicitly', () => {
  assert.equal(formatStoreKitPrice('49.90', 'BRL', 'pt-BR').replace(/[\u00a0\u202f]/g, ' '), 'R$ 49,90')
  assert.equal(normalizeStoreKitAmount('239.9'), '239.90')
  assert.equal(normalizeStoreKitAmount('359.00'), '359.00')
  assert.equal(normalizeStoreKitAmount('49.901'), '')
  assert.equal(formatStoreKitPrice('NaN', 'BRL'), '')
  assert.equal(formatStoreKitPrice('49.90', 'B1D'), '')
})

test('Periods and storefront normalization reject malformed values', () => {
  assert.equal(describeApplePeriod(-1, 'month'), '')
  assert.equal(describeApplePeriod(1, 'bad'), '')
  assert.equal(normalizeIosStorefrontCountryCode(' bra '), 'BRA')
  assert.equal(normalizeIosStorefrontCountryCode('us'), 'US')
  assert.equal(resolveIosPricingLocale('pt_BR'), 'pt-BR')
})
