import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIosSubscriptionCards, normalizeIosStorefrontCountryCode, resolveIosPricingLocale } from '../src/iosProductPresentation.js'

const locale = { locale: 'pt-BR' }
const monthly = {
  planId: 'mensal', displayPrice: 'R$ 49,90', currencyCode: 'BRL',
  storefrontCountryCode: 'BRA', introductoryOfferAvailable: true,
  introductoryDisplayPrice: 'R$ 9,90',
}

test('eligible Apple Account sees intro price and renewal separately', () => {
  const [plan] = buildIosSubscriptionCards([{...monthly, introductoryOfferEligible:true}], locale)
  assert.equal(plan.displayPrice,'R$ 9,90')
  assert.equal(plan.renewalText,'Depois, R$ 49,90/mês')
  assert.equal(plan.introEligibility,'eligible')
  assert.equal(plan.referencePriceUsed,false)
})
test('ineligible Apple Account sees regular price', () => {
  const [plan] = buildIosSubscriptionCards([{...monthly, introductoryOfferEligible:false}], locale)
  assert.equal(plan.displayPrice,'R$ 49,90')
  assert.equal(plan.introEligibility,'ineligible')
  assert.equal(plan.renewalText,'')
  assert.equal(plan.introductoryDisplayPrice,null)
})
test('unknown eligibility cannot promise promotion', () => {
  for(const p of [{...monthly}, {...monthly,introductoryOfferAvailable:false,introductoryOfferEligible:true}]) {
    const [plan] = buildIosSubscriptionCards([p], locale)
    assert.equal(plan.displayPrice,'R$ 49,90')
    assert.equal(plan.introEligibility,'unknown')
  }
})
test('verified Apple offer price is used even if different from reference', () => {
  const [plan] = buildIosSubscriptionCards([{...monthly,introductoryOfferEligible:true,introductoryDisplayPrice:'R$ 12,90'}], locale)
  assert.equal(plan.displayPrice,'R$ 12,90')
  assert.equal(plan.introductoryDisplayPrice,'R$ 12,90')
})
test('ineligible USD metadata uses non-promotional reference in Brazilian UI', () => {
  const [plan] = buildIosSubscriptionCards([{...monthly,displayPrice:'US$ 7.99',currencyCode:'USD',introductoryOfferEligible:false}],locale)
  assert.equal(plan.displayPrice,'R$ 49,90')
  assert.equal(plan.currencyMismatch,true)
})
test('eligible USD metadata uses clearly marked reference, not converted currency', () => {
  const [plan] = buildIosSubscriptionCards([{...monthly,displayPrice:'US$ 7.99',introductoryDisplayPrice:'US$ 1.99',currencyCode:'USD',introductoryOfferEligible:true}],locale)
  assert.equal(plan.displayPrice,'R$ 9,90')
  assert.equal(plan.referencePriceUsed,true)
})
test('no products cannot be claimed as available', () => {
  const cards=buildIosSubscriptionCards([],locale)
  assert.equal(cards[0].displayPrice,'R$ 49,90')
  assert.ok(cards.every(x=>!x.available))
})
test('other plans retain native BRL prices and labels', () => {
  const cards=buildIosSubscriptionCards([
    {planId:'semestral',displayPrice:'R$ 239,90',currencyCode:'BRL'},
    {planId:'anual',displayPrice:'R$ 359,00',currencyCode:'BRL'},
  ],locale)
  assert.deepEqual(cards.slice(1).map(x=>x.displayPrice),['R$ 239,90','R$ 359,00'])
  assert.equal(cards[1].introEligibility,'unknown')
})
test('non Brazil app shows native USD without Brazilian promotion', () => {
  const cards=buildIosSubscriptionCards([{...monthly,displayPrice:'US$ 7.99',currencyCode:'USD',storefrontCountryCode:'USA',introductoryOfferEligible:true}],{locale:'en-US'})
  assert.equal(cards[0].displayPrice,'US$ 7.99')
})
test('original country and app language handling preserved', () => {
  assert.equal(normalizeIosStorefrontCountryCode(' bra '),'BRA')
  assert.equal(normalizeIosStorefrontCountryCode('us'),'US')
  assert.equal(resolveIosPricingLocale('pt_BR'),'pt-BR')
})
