import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIosSubscriptionCards, normalizeIosStorefrontCountryCode, resolveIosPricingLocale } from '../src/iosProductPresentation.js'

test('StoreKit localized prices are displayed unchanged for all professional plans', () => {
  const products = [
    { planId: 'mensal', displayPrice: 'R$ 49,90', introductoryDisplayPrice: 'R$ 9,90' },
    { planId: 'semestral', displayPrice: 'R$ 239,40' },
    { planId: 'anual', displayPrice: 'R$ 358,80' },
  ]
  const cards = buildIosSubscriptionCards(products)
  assert.deepEqual(cards.map((item) => item.planId), ['mensal', 'semestral', 'anual'])
  assert.deepEqual(cards.map((item) => item.displayPrice), ['R$ 49,90', 'R$ 239,40', 'R$ 358,80'])
  assert.ok(cards.every((item) => item.available))
  assert.ok(cards.every((item) => item.introductoryDisplayPrice === null))
})

test('Native UI never fabricates price from Cartpanda when StoreKit data is missing', () => {
  const cards = buildIosSubscriptionCards([{ planId: 'mensal', displayPrice: 'US$ 7.99' }])
  assert.equal(cards[0].displayPrice, 'US$ 7.99')
  assert.equal(cards[1].displayPrice, 'Preço indisponível')
  assert.equal(cards[2].displayPrice, 'Preço indisponível')
  assert.equal(cards[1].available, false)
  assert.equal(cards[2].available, false)
})

test('Malformed StoreKit data cannot generate a hard-coded price', () => {
  const cards = buildIosSubscriptionCards([null, { planId: 'mensal', displayPrice: '' }])
  assert.ok(cards.every((item) => !item.available))
  assert.ok(cards.every((item) => item.displayPrice === 'Preço indisponível'))
})

test('StoreKit currency code is preserved; never relabel USD as BRL', () => {
  const cards = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'US$ 7,99', currencyCode: 'USD' },
    { planId: 'semestral', displayPrice: 'R$ 49,90', currencyCode: 'BRL' },
  ])
  assert.equal(cards[0].displayPrice, 'US$ 7,99')
  assert.equal(cards[0].currencyCode, 'USD')
  assert.equal(cards[1].displayPrice, 'R$ 49,90')
  assert.equal(cards[1].currencyCode, 'BRL')
  assert.equal(cards[2].available, false)
})

test('Pricing presentation recognizes localized US dollar symbol when code is absent', () => {
  const [card] = buildIosSubscriptionCards([{ planId: 'mensal', displayPrice: 'US$ 7,99' }])
  assert.equal(card.currencyCode, 'USD')
})

test('Brazilian interface never displays a USD numeric price as a BRL plan', () => {
  const cards = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'US$ 7,99', currencyCode: 'USD', storefrontCountryCode: 'US' },
    { planId: 'semestral', displayPrice: 'US$ 49,99', currencyCode: 'USD', storefrontCountryCode: 'BR' },
    { planId: 'anual', displayPrice: 'US$ 99,99', currencyCode: 'USD', storefrontCountryCode: '' },
  ], { locale: 'pt-BR' })
  assert.deepEqual(cards.map((card) => card.displayPrice), ['R$ 9,90', 'R$ 239,90', 'R$ 359,00'])
  assert.ok(cards.every((card) => card.currencyMismatch && card.referencePriceUsed && card.available))
  assert.equal(cards[0].renewalText, 'Depois, R$ 49,90/mês')
  assert.equal(cards[0].storefrontCountryCode, 'US')
  assert.equal(cards[1].storefrontCountryCode, 'BR')
})

test('Brazilian prices from StoreKit are displayed as returned, without guessing offers', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'R$ 49,90', currencyCode: 'BRL', storefrontCountryCode: 'BR', introductoryDisplayPrice: 'R$ 9,90' },
  ], { locale: 'pt-BR' })
  assert.equal(card.displayPrice, 'R$ 9,90')
  assert.equal(card.renewalText, 'Depois, R$ 49,90/mês')
  assert.equal(card.priceDescription, 'Primeiro mês para novos assinantes elegíveis')
  assert.equal(card.referencePriceUsed, false)
  assert.equal(card.currencyCode, 'BRL')
  assert.equal(card.storefrontCountryCode, 'BR')
  assert.equal(card.currencyMismatch, false)
  assert.equal(card.introductoryDisplayPrice, 'R$ 9,90')
})

test('A US storefront with USD is displayed correctly to an English US user', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'US$ 7.99', currencyCode: 'USD', storefrontCountryCode: 'US' },
  ], { locale: 'en-US' })
  assert.equal(card.currencyMismatch, false)
  assert.equal(card.displayPrice, 'US$ 7.99')
})

test('Even an English interface flags BR storefront returning USD', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'US$ 7.99', currencyCode: 'USD', storefrontCountryCode: 'BR' },
  ], { locale: 'en-US' })
  assert.equal(card.currencyMismatch, true)
  assert.equal(card.displayPrice, 'Confira o preço na App Store')
})

test('Build 6 uses the Brazilian app language even when no device locale is available', () => {
  assert.equal(resolveIosPricingLocale('pt-br'), 'pt-BR')
  assert.equal(resolveIosPricingLocale('pt_BR'), 'pt-BR')
  assert.equal(resolveIosPricingLocale('pt'), 'pt-BR')
  assert.equal(resolveIosPricingLocale(''), 'pt-BR')
  assert.equal(resolveIosPricingLocale('invalid locale!'), 'pt-BR')
  assert.equal(resolveIosPricingLocale('en-us'), 'en-US')
})

test('StoreKit alpha-3 country codes and legacy alpha-2 codes are preserved', () => {
  assert.equal(normalizeIosStorefrontCountryCode(' bra '), 'BRA')
  assert.equal(normalizeIosStorefrontCountryCode('br'), 'BR')
  assert.equal(normalizeIosStorefrontCountryCode('USA'), 'USA')
  assert.equal(normalizeIosStorefrontCountryCode('us'), 'US')
  assert.equal(normalizeIosStorefrontCountryCode('Brazil'), '')
  assert.equal(normalizeIosStorefrontCountryCode(null), '')
})

test('Actual Apple BRA storefront flags USD even when the device/app locale is English', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'US$ 7,99', currencyCode: 'USD', storefrontCountryCode: 'BRA' },
  ], { locale: 'en-US' })
  assert.equal(card.storefrontCountryCode, 'BRA')
  assert.equal(card.currencyMismatch, true)
  assert.equal(card.displayPrice, 'Confira o preço na App Store')
  assert.equal(card.available, true)
})

test('The three TestFlight prices in the report are never shown as numeric prices in the Brazilian app', () => {
  const products = [
    { planId: 'mensal', displayPrice: 'US$ 7,99', currencyCode: 'USD', storefrontCountryCode: 'USA' },
    { planId: 'semestral', displayPrice: 'US$ 49,99', currencyCode: 'USD', storefrontCountryCode: 'BRA' },
    { planId: 'anual', displayPrice: 'US$ 99,99', currencyCode: 'USD', storefrontCountryCode: '' },
  ]
  for (const locale of ['pt-BR', 'pt_BR', 'pt', 'pt-BR-u-nu-latn']) {
    const cards = buildIosSubscriptionCards(products, { locale })
    assert.ok(cards.every((card) => card.currencyMismatch && card.referencePriceUsed && card.available))
    assert.deepEqual(cards.map((card) => card.displayPrice), ['R$ 9,90', 'R$ 239,90', 'R$ 359,00'])
    assert.ok(cards.every((card) => card.currencyCode === 'USD'))
  }
})

test('BRL product amounts with Apple BRA metadata are displayed exactly as supplied', () => {
  const values = ['R$\u00a049,90', 'R$ 239,40', 'R$ 358,80']
  const cards = buildIosSubscriptionCards(values.map((displayPrice, index) => ({
    planId: ['mensal', 'semestral', 'anual'][index], displayPrice,
    currencyCode: 'BRL', storefrontCountryCode: 'BRA',
  })), { locale: 'pt-BR' })
  assert.deepEqual(cards.map((card) => card.displayPrice), ['R$ 9,90', 'R$ 239,40', 'R$ 358,80'])
  assert.equal(cards[0].renewalText, 'Depois, R$\u00a049,90/mês')
  assert.ok(cards.every((card) => !card.currencyMismatch && card.available))
})

test('A USD price string is not trusted even if the bridge incorrectly labels it BRL', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'US$ 7,99', currencyCode: 'BRL', storefrontCountryCode: 'BRA' },
  ], { locale: 'pt-BR' })
  assert.equal(card.currencyMismatch, true)
  assert.equal(card.referencePriceUsed, true)
  assert.equal(card.displayPrice, 'R$ 9,90')
})

test('A BRL-looking price is not trusted when the actual product currency is USD', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'R$ 7,99', currencyCode: 'USD', storefrontCountryCode: 'USA' },
  ], { locale: 'en-US' })
  assert.equal(card.currencyMismatch, true)
  assert.equal(card.currencyCode, 'USD')
  assert.equal(card.displayPrice, 'Confira o preço na App Store')
})

test('Unicode spaces and bidi characters cannot bypass the foreign currency check', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: '\u200eUS\u00a0$\u202f7,99', storefrontCountryCode: 'BRA' },
  ], { locale: 'pt-BR' })
  assert.equal(card.currencyCode, 'USD')
  assert.equal(card.currencyMismatch, true)
})

test('A bare dollar symbol without reliable currency metadata is not presented as a Brazilian price', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: '$7.99', storefrontCountryCode: 'BRA' },
  ], { locale: 'pt-BR' })
  assert.equal(card.currencyMismatch, true)
  assert.equal(card.referencePriceUsed, true)
  assert.equal(card.displayPrice, 'R$ 9,90')
})

test('USD ISO currency text after the number is detected when bridge currency metadata is missing', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: '7,99 USD', storefrontCountryCode: 'BRA' },
  ], { locale: 'pt-BR' })
  assert.equal(card.currencyCode, 'USD')
  assert.equal(card.currencyMismatch, true)
})

test('Other foreign currencies also require honest confirmation in the Brazilian interface', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: '€7,99', currencyCode: 'EUR', storefrontCountryCode: 'DEU' },
  ], { locale: 'pt-BR' })
  assert.equal(card.currencyMismatch, true)
  assert.equal(card.referencePriceUsed, true)
  assert.equal(card.displayPrice, 'R$ 9,90')
})

test('Foreign prices remain untouched in a matching non-Brazilian app and storefront', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: '$7.99', currencyCode: 'USD', storefrontCountryCode: 'USA' },
  ], { locale: 'en-US' })
  assert.equal(card.currencyMismatch, false)
  assert.equal(card.displayPrice, '$7.99')
})

test('Brazil price fallback remains informational when App Store has no available products', () => {
  const cards = buildIosSubscriptionCards([], { locale: 'pt-BR' })
  assert.deepEqual(cards.map((card) => card.displayPrice), ['R$ 9,90', 'R$ 239,90', 'R$ 359,00'])
  assert.ok(cards.every((card) => !card.available))
  assert.ok(cards.every((card) => card.referencePriceUsed))
})

test('Native introductory price overrides Brazil reference only if verified as BRL metadata', () => {
  const [card] = buildIosSubscriptionCards([{
    planId: 'mensal',
    displayPrice: 'R$ 49,90',
    introductoryDisplayPrice: 'R$ 12,90',
    currencyCode: 'BRL',
    storefrontCountryCode: 'BRA',
  }], { locale: 'pt-BR' })
  assert.equal(card.displayPrice, 'R$ 12,90')
  assert.equal(card.renewalText, 'Depois, R$ 49,90/mês')
  assert.equal(card.referencePriceUsed, false)
})

test('Brazil reference prices stay explicit when native introductory offer is quoted in USD', () => {
  const [card] = buildIosSubscriptionCards([{
    planId: 'mensal',
    displayPrice: 'US$ 7.99',
    introductoryDisplayPrice: 'US$ 1.99',
    currencyCode: 'USD',
    storefrontCountryCode: 'BRA',
  }], { locale: 'pt-BR' })
  assert.equal(card.displayPrice, 'R$ 9,90')
  assert.equal(card.renewalText, 'Depois, R$ 49,90/mês')
  assert.equal(card.referencePriceUsed, true)
})
