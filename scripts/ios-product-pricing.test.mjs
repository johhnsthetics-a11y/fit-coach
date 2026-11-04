import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIosSubscriptionCards, normalizeIosStorefrontCountryCode, resolveIosPricingLocale } from '../src/iosProductPresentation.js'
import { getIosIntroOffer, getIosPurchaseTermsExpectation, describeApplePeriod } from '../src/iosIntroOffer.js'

const locale = { locale: 'pt-BR' }
const monthly = {
  id: 'br.com.coachfitpro.ios.profissional.mensal', planId: 'mensal',
  displayPrice: 'R$ 49,90', currencyCode: 'BRL', storefrontCountryCode: 'BRA',
  subscriptionGroupId: 'demo-group', subscriptionPeriodValue: 1, subscriptionPeriodUnit: 'month',
  introductoryOfferAvailable: true, introductoryOfferEligible: true,
  introductoryDisplayPrice: 'R$ 9,90', introductoryPaymentMode: 'payAsYouGo',
  introductoryPeriodValue: 1, introductoryPeriodUnit: 'month', introductoryPeriodCount: 1,
}
const card = (overrides = {}, options = locale) => buildIosSubscriptionCards([{ ...monthly, ...overrides }], options)[0]

test('Eligible Apple Account sees the actual intro charge and the exact renewal separately', () => {
  const plan = card({ introductoryOfferEligible: true })
  assert.equal(plan.displayPrice, 'R$ 9,90')
  assert.equal(plan.standardPrice, 'R$ 49,90')
  assert.equal(plan.renewalText, 'Depois, R$ 49,90/mês')
  assert.equal(plan.introEligibility, 'eligible')
  assert.equal(plan.introAppliedToDisplay, true)
  assert.equal(plan.purchaseAvailable, true)
  assert.match(plan.introductoryTerms, /R\$ 9,90 pelo período inicial de 1 mês/)
})

test('An ineligible Apple Account sees the exact regular StoreKit price', () => {
  const plan = card({ introductoryOfferEligible: false })
  assert.equal(plan.displayPrice, 'R$ 49,90')
  assert.equal(plan.introEligibility, 'ineligible')
  assert.equal(plan.purchaseAvailable, true)
  assert.equal(plan.renewalText, '')
})

test('Unknown eligibility cannot display a presumed regular charge as purchasable', () => {
  const plan = card({ introductoryOfferEligible: undefined })
  assert.equal(plan.displayPrice, 'R$ 49,90')
  assert.equal(plan.introStatus, 'unknown')
  assert.equal(plan.purchaseAvailable, false)
  assert.match(plan.purchaseBlockReason, /Apple ainda não confirmou/)
})

test('If no introductory offer exists, the current Apple price remains purchasable', () => {
  const plan = card({ introductoryOfferAvailable: false, introductoryOfferEligible: false })
  assert.equal(plan.displayPrice, 'R$ 49,90')
  assert.equal(plan.introStatus, 'unavailable')
  assert.equal(plan.purchaseAvailable, true)
})

test('StoreKit price wins over a marketing reference', () => {
  const plan = card({ displayPrice: 'R$ 12,90', introductoryOfferAvailable: false })
  assert.equal(plan.displayPrice, 'R$ 12,90')
  assert.equal(plan.purchaseAvailable, true)
})

test('A Brazilian storefront with inconsistent USD metadata cannot start checkout or show a guessed BRL price', () => {
  const plan = card({ displayPrice: 'US$ 7.99', introductoryDisplayPrice: 'US$ 1.99', currencyCode: 'USD', introductoryOfferEligible: true })
  assert.equal(plan.displayPrice, 'Preço não confirmado')
  assert.equal(plan.currencyMismatch, true)
  assert.equal(plan.introAppliedToDisplay, false)
  assert.equal(plan.purchaseAvailable, false)
})

test('A real foreign storefront shows its own StoreKit currency, even in the Portuguese app', () => {
  const plan = card({ displayPrice: 'US$ 7.99', introductoryDisplayPrice: 'US$ 1.99', currencyCode: 'USD', storefrontCountryCode: 'USA', introductoryOfferEligible: true })
  assert.equal(plan.displayPrice, 'US$ 1.99')
  assert.equal(plan.currencyMismatch, false)
  assert.equal(plan.purchaseAvailable, true)
})

test('Unknown currency metadata does not fall back to a reference amount', () => {
  const plan = card({ displayPrice: '49.90', currencyCode: '', storefrontCountryCode: '' })
  assert.equal(plan.displayPrice, 'Preço não confirmado')
  assert.equal(plan.purchaseAvailable, false)
})

test('A mismatched intro currency is blocked instead of displaying only the regular price', () => {
  const plan = card({ introductoryOfferEligible: true, introductoryDisplayPrice: 'US$ 1.99' })
  assert.equal(plan.displayPrice, 'R$ 49,90')
  assert.equal(plan.introAppliedToDisplay, false)
  assert.equal(plan.purchaseAvailable, false)
})

test('Incomplete eligible-offer terms are blocked until StoreKit provides a matching quote', () => {
  for (const override of [{ introductoryPeriodValue: undefined }, { introductoryPeriodUnit: '' }, { introductoryPeriodCount: 0 }, { introductoryPaymentMode: 'unknown' }]) {
    const plan = card({ introductoryOfferEligible: true, ...override })
    assert.equal(plan.introAppliedToDisplay, false)
    assert.equal(plan.displayPrice, 'R$ 49,90')
    assert.equal(plan.purchaseAvailable, false)
  }
})

test('Pay-up-front and free-trial terms remain explicit and price aligned', () => {
  assert.match(getIosIntroOffer({ ...monthly, introductoryOfferEligible: true, introductoryPeriodCount: 3 }).terms, /a cada 1 mês, durante 3 meses/)
  assert.match(getIosIntroOffer({ ...monthly, introductoryOfferEligible: true, introductoryPaymentMode: 'payUpFront', introductoryPeriodValue: 2 }).terms, /pelo período inicial de 2 meses/)
  const trial = card({ introductoryOfferEligible: true, introductoryPaymentMode: 'freeTrial', introductoryDisplayPrice: 'R$ 0,00', introductoryPeriodValue: 7, introductoryPeriodUnit: 'day' })
  assert.equal(trial.displayPrice, 'R$ 0,00')
  assert.match(trial.introductoryTerms, /Teste gratuito por 7 dias/)
  assert.equal(trial.renewalText, 'Depois, R$ 49,90/mês')
})

test('No products have no price and cannot open purchase', () => {
  const cards = buildIosSubscriptionCards([], locale)
  assert.equal(cards[0].displayPrice, 'Preço indisponível')
  assert.equal(cards[0].introStatus, 'loading')
  assert.ok(cards.every(plan => !plan.available && !plan.purchaseAvailable))
})

test('Other plans retain their exact native StoreKit prices', () => {
  const cards = buildIosSubscriptionCards([
    { planId: 'semestral', displayPrice: 'R$ 239,90', currencyCode: 'BRL', storefrontCountryCode: 'BRA' },
    { planId: 'anual', displayPrice: 'R$ 359,00', currencyCode: 'BRL', storefrontCountryCode: 'BRA' },
  ], locale)
  assert.deepEqual(cards.slice(1).map(x => x.displayPrice), ['R$ 239,90', 'R$ 359,00'])
  assert.ok(cards.slice(1).every(plan => plan.purchaseAvailable))
})

test('Purchase snapshot contains exact standard/introductory prices and storefront', () => {
  const terms = getIosPurchaseTermsExpectation(monthly)
  assert.equal(terms.id, monthly.id)
  assert.equal(terms.displayPrice, 'R$ 49,90')
  assert.equal(terms.currencyCode, 'BRL')
  assert.equal(terms.storefrontCountryCode, 'BRA')
  assert.equal(terms.introductoryOfferEligible, true)
  assert.equal(terms.introductoryDisplayPrice, 'R$ 9,90')
  assert.equal(terms.introductoryPeriodCount, 1)
  assert.equal(getIosPurchaseTermsExpectation(null), null)
})

test('Periods and storefront normalization reject malformed values', () => {
  assert.equal(describeApplePeriod(-1, 'month'), '')
  assert.equal(describeApplePeriod(1, 'bad'), '')
  assert.equal(normalizeIosStorefrontCountryCode(' bra '), 'BRA')
  assert.equal(normalizeIosStorefrontCountryCode('us'), 'US')
  assert.equal(resolveIosPricingLocale('pt_BR'), 'pt-BR')
})
