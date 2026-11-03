import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { getConfirmedWebCycle, getVerifiedIosSubscription, getSafeSubscriptionCheckoutUrl, formatSubscriptionDate } from '../src/subscriptionPresentation.js'

const accountId = '11111111-1111-4111-8111-111111111111'
const products = Object.fromEntries(['mensal','semestral','anual'].map(p => [p, `br.com.coachfitpro.ios.profissional.${p}`]))
const now = Date.parse('2026-11-02T15:00:00Z')
const transaction = (plan = 'mensal', overrides = {}) => ({
  active: true, revoked: false, accountId, productId: products[plan],
  purchaseDate: '2026-11-01T15:00:00Z', expirationDate: '2026-12-01T15:00:00Z', ...overrides,
})

for (const plan of ['mensal','semestral','anual']) {
  test(`iOS displays the exact ${plan} plan from a verified Apple transaction`, () => {
    const result = getVerifiedIosSubscription([transaction(plan)], accountId, products, now)
    assert.equal(result.planId, plan)
    assert.equal(result.provider, 'App Store')
    assert.ok(result.expiresAt)
  })
}

test('Other account, revoked, expired and missing expiry are never shown as a paid Apple plan', () => {
  for (const overrides of [
    { accountId: '22222222-2222-4222-8222-222222222222' },
    { revoked: true }, { active: false }, { expirationDate: '' },
    { expirationDate: '2026-10-01T00:00:00Z' }, { expirationDate: 'bad' },
    { productId: 'other' },
  ]) assert.equal(getVerifiedIosSubscription([transaction('mensal', overrides)], accountId, products, now), null)
})

test('Most recent verified subscription wins when several entitlements exist', () => {
  const chosen = getVerifiedIosSubscription([
    transaction('anual', { purchaseDate: '2026-10-01T15:00:00Z' }),
    transaction('semestral'),
  ], accountId, products, now)
  assert.equal(chosen.planId, 'semestral')
})

test('Only safe HTTPS checkout links without embedded credentials pass', () => {
  assert.equal(getSafeSubscriptionCheckoutUrl('https://example.org/pay'), 'https://example.org/pay')
  for (const value of ['javascript:alert(1)', 'http://example.org', 'https://user:pass@example.org', '']) {
    assert.equal(getSafeSubscriptionCheckoutUrl(value), '')
  }
})

test('Web plan cannot be inferred from a local card selection or missing paid period', () => {
  assert.equal(getConfirmedWebCycle({ status: 'active', planId: 'anual' }), '')
  assert.equal(getConfirmedWebCycle({ currentPeriodStartedAt: '2026-01-01T00:00:00Z', currentPeriodEndsAt: '2026-07-01T00:00:00Z' }), 'semestral')
  assert.equal(getConfirmedWebCycle({ currentPeriodStartedAt: '2026-01-01T00:00:00Z', currentPeriodEndsAt: '2027-01-01T00:00:00Z' }), 'anual')
})

test('Never invent a billing date when the provider did not supply one', () => {
  assert.equal(formatSubscriptionDate(''), 'Não informado pelo provedor')
})

test('New Minha Assinatura screens are present, and Apple purchase flow is still direct', () => {
  const panel = fs.readFileSync(new URL('../src/NativeIosSubscriptionPanel.jsx', import.meta.url), 'utf8')
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const web = fs.readFileSync(new URL('../src/WebSubscriptionPanel.jsx', import.meta.url), 'utf8')
  for (const label of ['Minha assinatura', 'Ciclo contratado', 'Acesso válido até', 'Gerenciar na Apple', 'Restaurar compras', 'Plano selecionado']) {
    assert.ok(panel.includes(label), label)
  }
  assert.match(panel, /await purchaseIosPlan\(plan\.planId, accountId, displayedProduct\)/)
  assert.doesNotMatch(panel.slice(panel.indexOf('async function purchase(plan)'), panel.indexOf('async function restore()')), /await loadIosProducts\(\)/)
  assert.match(app, /onNativeEntitlementChange=\{handleVerifiedIosSubscription\}/)
  assert.match(web, /Escolha seu ciclo/)
  assert.match(web, /getWebSubscriptionSummary/)
})
