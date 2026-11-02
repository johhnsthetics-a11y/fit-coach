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

test('Brazilian interface avoids false USD prices while retaining Apple purchase availability', () => {
  const cards = buildIosSubscriptionCards([
    { planId: 'mensal', displayPrice: 'US$ 7,99' },
    { planId: 'semestral', displayPrice: 'US$ 49,99' },
    { planId: 'anual', displayPrice: 'US$ 99,99' },
  ], { locale: 'pt-BR' })
  assert.ok(cards.every((card) => card.currencyMismatch))
  assert.ok(cards.every((card) => card.available))
  assert.ok(cards.every((card) => !card.displayPrice.includes('US$')))
  assert.ok(cards.every((card) => card.displayPrice.includes('App Store')))
})

test('Correct Brazilian currency is retained unchanged', () => {
  const [card] = buildIosSubscriptionCards([{ planId: 'mensal', displayPrice: 'R$ 49,90' }], { locale: 'pt-BR' })
  assert.equal(card.displayPrice, 'R$ 49,90')
  assert.equal(card.currencyMismatch, false)
})

test('Legitimate USD App Store price remains visible outside Brazilian interface', () => {
  const [card] = buildIosSubscriptionCards([{ planId: 'mensal', displayPrice: 'US$ 7.99' }], { locale: 'en-US' })
  assert.equal(card.displayPrice, 'US$ 7.99')
  assert.equal(card.currencyMismatch, false)
})
