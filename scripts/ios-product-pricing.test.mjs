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
