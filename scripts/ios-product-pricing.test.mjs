import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIosSubscriptionCards } from '../src/iosProductPresentation.js'

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
  assert.ok(cards.every((card) => card.currencyMismatch))
  assert.ok(cards.every((card) => card.available))
  assert.ok(cards.every((card) => card.displayPrice === 'Confira o preço na App Store'))
  assert.equal(cards[0].storefrontCountryCode, 'US')
  assert.equal(cards[1].storefrontCountryCode, 'BR')
})

test('Brazilian prices from StoreKit are displayed as returned, without guessing offers', () => {
  const [card] = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'R$ 49,90', currencyCode: 'BRL', storefrontCountryCode: 'BR', introductoryDisplayPrice: 'R$ 9,90' },
  ], { locale: 'pt-BR' })
  assert.equal(card.displayPrice, 'R$ 49,90')
  assert.equal(card.currencyCode, 'BRL')
  assert.equal(card.storefrontCountryCode, 'BR')
  assert.equal(card.currencyMismatch, false)
  assert.equal(card.introductoryDisplayPrice, null)
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
