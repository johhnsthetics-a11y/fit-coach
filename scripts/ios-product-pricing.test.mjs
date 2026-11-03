import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIosSubscriptionCards, normalizeIosStorefrontCountryCode, resolveIosPricingLocale } from '../src/iosProductPresentation.js'
import { getIosIntroOffer, describeApplePeriod, getIosPurchaseOfferExpectation, getIosOfferDiagnostics } from '../src/iosIntroOffer.js'

const locale = { locale: 'pt-BR' }
const monthly = {
  id: 'br.com.coachfitpro.ios.profissional.mensal', planId: 'mensal',
  displayPrice: 'R$ 49,90', currencyCode: 'BRL', storefrontCountryCode: 'BRA',
  subscriptionGroupId: 'demo-group', introductoryOfferAvailable: true,
  introductoryDisplayPrice: 'R$ 9,90', introductoryPaymentMode: 'payAsYouGo',
  introductoryPeriodValue: 1, introductoryPeriodUnit: 'month', introductoryPeriodCount: 1,
}
const card = (overrides = {}) => buildIosSubscriptionCards([{ ...monthly, ...overrides }], locale)[0]

test('Eligible Apple Account sees the actual introductory price and renewal separately', () => {
  const plan = card({ introductoryOfferEligible: true })
  assert.equal(plan.displayPrice, 'R$ 9,90')
  assert.equal(plan.renewalText, 'Depois, R$ 49,90/mês')
  assert.equal(plan.introEligibility, 'eligible')
  assert.equal(plan.introAppliedToDisplay, true)
  assert.match(plan.introductoryTerms, /R\$ 9,90 pelo período inicial de 1 mês/)
  assert.equal(plan.referencePriceUsed, false)
})
test('A new app account cannot override an ineligible Apple Account', () => {
  const plan = card({ introductoryOfferEligible: false, accountCreatedAt: new Date().toISOString(), isNewUser: true })
  assert.equal(plan.displayPrice, 'R$ 49,90')
  assert.equal(plan.introEligibility, 'ineligible')
  assert.equal(plan.introStatus, 'ineligible')
  assert.equal(plan.renewalText, '')
  assert.equal(plan.introductoryDisplayPrice, null)
  assert.equal(plan.priceDescription, 'Renovação mensal')
  assert.doesNotMatch(plan.priceDescription, /oferta|desconto|elegib/i)
})
test('Unknown eligibility and absent offer are distinct and cannot promise promotion', () => {
  const unknown = card()
  assert.equal(unknown.displayPrice, 'R$ 49,90')
  assert.equal(unknown.introStatus, 'unknown')
  const absent = card({ introductoryOfferAvailable: false, introductoryOfferEligible: true })
  assert.equal(absent.displayPrice, 'R$ 49,90')
  assert.equal(absent.introStatus, 'unavailable')
  assert.equal(absent.introEligibility, 'unknown')
  for (const plan of [unknown, absent]) {
    assert.equal(plan.priceDescription, 'Renovação mensal')
    assert.doesNotMatch(plan.priceDescription, /oferta|desconto|elegib/i)
  }
})
test('Apple price different from marketing reference remains authoritative', () => {
  assert.equal(card({ introductoryOfferEligible: true, introductoryDisplayPrice: 'R$ 12,90' }).displayPrice, 'R$ 12,90')
})
test('USD metadata never becomes an allegedly confirmed BRL intro price', () => {
  for (const eligible of [false, true]) {
    const plan = card({ displayPrice: 'US$ 7.99', introductoryDisplayPrice: 'US$ 1.99', currencyCode: 'USD', introductoryOfferEligible: eligible })
    assert.equal(plan.displayPrice, 'R$ 49,90')
    assert.equal(plan.currencyMismatch, true)
    assert.equal(plan.referencePriceUsed, true)
    assert.equal(plan.introAppliedToDisplay, false)
    assert.equal(plan.introductoryDisplayPrice, null)
  }
})
test('A mixed intro and regular currency cannot be a guaranteed offer', () => {
  assert.equal(card({ introductoryOfferEligible: true, introductoryDisplayPrice: 'US$ 1.99' }).introAppliedToDisplay, false)
})
test('Missing duration or unknown mode cannot be described as first month', () => {
  for (const override of [{ introductoryPeriodValue: undefined }, { introductoryPeriodUnit: '' }, { introductoryPeriodCount: 0 }, { introductoryPaymentMode: 'unknown' }]) {
    const plan = card({ introductoryOfferEligible: true, ...override })
    assert.equal(plan.introAppliedToDisplay, false)
    assert.equal(plan.displayPrice, 'R$ 49,90')
  }
})
test('Pay up front and pay as you go retain real duration and number of periods', () => {
  assert.match(getIosIntroOffer({ ...monthly, introductoryOfferEligible: true, introductoryPeriodCount: 3 }).terms, /a cada 1 mês, durante 3 meses/)
  assert.match(getIosIntroOffer({ ...monthly, introductoryOfferEligible: true, introductoryPaymentMode: 'payUpFront', introductoryPeriodValue: 2 }).terms, /pelo período inicial de 2 meses/)
})
test('Free trial is not mislabeled as the owners paid first-month offer', () => {
  const plan = card({ introductoryOfferEligible: true, introductoryPaymentMode: 'freeTrial', introductoryDisplayPrice: 'R$ 0,00', introductoryPeriodValue: 7, introductoryPeriodUnit: 'day' })
  assert.equal(plan.displayPrice, 'R$ 0,00')
  assert.match(plan.introductoryTerms, /Teste gratuito por 7 dias/)
  assert.equal(plan.renewalText, 'Depois, R$ 49,90/mês')
})
test('No products are never claimed available or offered at guaranteed intro price', () => {
  const cards = buildIosSubscriptionCards([], locale)
  assert.equal(cards[0].displayPrice, 'R$ 49,90')
  assert.equal(cards[0].introStatus, 'loading')
  assert.equal(cards[0].referencePriceUsed, true)
  assert.ok(cards.every(plan => !plan.available))
})
test('Other plans retain native BRL prices and labels', () => {
  const cards = buildIosSubscriptionCards([{ planId: 'semestral', displayPrice: 'R$ 239,90', currencyCode: 'BRL' }, { planId: 'anual', displayPrice: 'R$ 359,00', currencyCode: 'BRL' }], locale)
  assert.deepEqual(cards.slice(1).map(x => x.displayPrice), ['R$ 239,90', 'R$ 359,00'])
})
test('Non-Brazil locale may display its real eligible Apple offer, never a BRL reference', () => {
  const [plan] = buildIosSubscriptionCards([{ ...monthly, displayPrice: 'US$ 7.99', introductoryDisplayPrice: 'US$ 1.99', currencyCode: 'USD', storefrontCountryCode: 'USA', introductoryOfferEligible: true }], { locale: 'en-US' })
  assert.equal(plan.displayPrice, 'US$ 1.99')
  assert.equal(plan.referencePriceUsed, false)
})
test('Offer expectation carries only offer facts, not a local eligibility override', () => {
  const expected = getIosPurchaseOfferExpectation({ ...monthly, introductoryOfferEligible: false })
  assert.deepEqual(expected, { available: true, eligible: false, displayPrice: 'R$ 9,90', paymentMode: 'payAsYouGo', periodValue: 1, periodUnit: 'month', periodCount: 1 })
  assert.equal(getIosPurchaseOfferExpectation(undefined), undefined)
})
test('Diagnostic report separates offer absence and ineligibility without account identifiers', () => {
  const report = getIosOfferDiagnostics({ ...monthly, introductoryOfferEligible: false, accountId: 'secret-account-id' })
  assert.match(report, /não elegível/)
  assert.match(report, /demo-group/)
  assert.doesNotMatch(report, /secret-account-id/)
  assert.match(getIosOfferDiagnostics(null), /não carregado/)
})
test('Invalid periods and country/app language handling are safe', () => {
  assert.equal(describeApplePeriod(-1, 'month'), '')
  assert.equal(describeApplePeriod(1, 'bad'), '')
  assert.equal(normalizeIosStorefrontCountryCode(' bra '), 'BRA')
  assert.equal(normalizeIosStorefrontCountryCode('us'), 'US')
  assert.equal(resolveIosPricingLocale('pt_BR'), 'pt-BR')
})
