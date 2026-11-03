import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { formatVerifiedAppleAmount, getVerifiedIosSubscription } from '../src/subscriptionPresentation.js'
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const accountId = '11111111-1111-4111-8111-111111111111'
const productId = 'br.com.coachfitpro.ios.profissional.mensal'
const now = Date.parse('2026-11-02T15:00:00Z')
const entitlement = { id: 'demo', active: true, revoked: false, productId, accountId, purchaseDate: '2026-11-02T14:00:00Z', expirationDate: '2026-12-02T14:00:00Z', transactionPrice: '9.9', transactionCurrencyCode: 'BRL', appliedOfferType: 'introductory' }

test('Signed transaction amount preserves the first-period discount, not catalog price', () => {
  const result = getVerifiedIosSubscription([entitlement], accountId, { mensal: productId }, now)
  assert.equal(result.transactionAmount.replaceAll('\u00a0', ' '), 'R$ 9,90')
  assert.equal(result.appliedOfferType, 'introductory')
  assert.ok(!('regularPrice' in result))
})
test('A renewed full-price transaction is not misreported as a missing introductory offer', () => {
  const result = getVerifiedIosSubscription([{ ...entitlement, transactionPrice: '49.9', appliedOfferType: 'none' }], accountId, { mensal: productId }, now)
  assert.equal(result.transactionAmount.replaceAll('\u00a0', ' '), 'R$ 49,90')
  assert.equal(result.appliedOfferType, 'none')
})
test('Missing signed amount never falls back to a guessed first-month or catalog amount', () => {
  for (const value of [{}, { transactionPrice: '9.9' }, { transactionPrice: '-1', transactionCurrencyCode: 'BRL' }, { transactionPrice: 'NaN', transactionCurrencyCode: 'BRL' }, { transactionPrice: 9.9, transactionCurrencyCode: 'BRL' }, { transactionPrice: '9.9', transactionCurrencyCode: 'bad currency' }]) assert.equal(formatVerifiedAppleAmount(value), '')
  assert.match(formatVerifiedAppleAmount({ transactionPrice: '0', transactionCurrencyCode: 'BRL' }), /0,00/)
})
test('Actual foreign-currency transaction retains its own currency; it is never relabeled BRL', () => {
  assert.match(formatVerifiedAppleAmount({ transactionPrice: '7.99', transactionCurrencyCode: 'USD' }), /US\$.*7,99/)
})
test('Introductory eligibility is queried only from Apple, not overwritten from app account', () => {
  const swift = read('plugins/coachfit-storekit/ios/Sources/CoachFitStoreKit/CoachFitStoreKitPlugin.swift')
  assert.match(swift, /await subscription\.isEligibleForIntroOffer/)
  assert.match(swift, /subscription\.subscriptionGroupID/)
  assert.match(swift, /offer\.period\.value/)
  assert.match(swift, /offer\.period\.unit/)
  assert.doesNotMatch(swift, /introductoryOfferEligibility\(/)
  assert.match(swift, /product\.purchase\(options: \[\.appAccountToken\(accountToken\)\]\)/)
})
test('Native offer change returns a no-purchase result before opening Apple payment', () => {
  const swift = read('plugins/coachfit-storekit/ios/Sources/CoachFitStoreKit/CoachFitStoreKitPlugin.swift')
  assert.ok(swift.indexOf('introductoryOfferChanged(expected, current)') < swift.indexOf('product.purchase('))
  assert.match(swift, /"offerChanged": true/)
  assert.match(swift, /wasAvailable != isAvailable \|\| wasEligible != isEligible/)
  assert.match(swift, /\("periodCount", "introductoryPeriodCount"\)/)
  assert.match(swift, /transaction\.price/)
  assert.match(swift, /transaction\.currency/)
  assert.match(swift, /transaction\.offerType == \.introductory/)
})
test('UI reports changed offer without calling access callback or buying a second time', () => {
  const panel = read('src/NativeIosSubscriptionPanel.jsx')
  const changed = panel.slice(panel.indexOf('if (result.offerChanged)'), panel.indexOf('} else if (result.cancelled)'))
  assert.match(changed, /Nenhuma compra foi iniciada/)
  assert.doesNotMatch(changed, /onNativeEntitlementChange|purchaseIosPlan/)
  // The redundant pre-purchase checkbox is removed. The Apple payment
  // confirmation remains responsible for final amount/offer disclosure.
  assert.doesNotMatch(panel, /Entendi que o desconto não está confirmado/)
  assert.doesNotMatch(panel, /allowRegularMonthly|regularMonthlyNeedsConsent/)
  assert.match(panel, /const canPurchase = accountValid && !hasAccess/)
  assert.match(panel, /purchaseIosPlan\(plan\.planId, accountId, displayedProduct\)/)
  // No mention of unavailable/ineligible promotions in regular price UI.
  assert.doesNotMatch(panel, /Sobre a oferta do primeiro mês|Atualizar oferta Apple|Ver detalhes da oferta/)
  assert.doesNotMatch(panel, /não é elegível à oferta introdutória|Criar outra conta Coach Fit Pro não reinicia/)
  assert.doesNotMatch(panel, /getIosOfferDiagnostics|subscription-offer-status|monthlyProduct/)
  assert.match(panel, /selectedPlan\?\.introAppliedToDisplay \?/)
  assert.doesNotMatch(panel, /A Apple indicou que esta conta é elegível à oferta introdutória|oferta Apple — build 12/)
  assert.match(panel, /O preço, o ciclo e a renovação apresentados pela App Store serão confirmados antes da autorização/)
  assert.match(panel, /data-subscription-ui="build-15"/)
  assert.match(panel, /Confira a renovação e o valor final na Apple/)
})
test('Offer-change and pending results cannot grant access in the bridge', () => {
  const ios = read('src/iosStoreKit.js')
  assert.ok(ios.indexOf('if (purchase.offerChanged)') < ios.indexOf('const verifiedPurchase'))
  assert.match(ios, /mergeVerifiedPurchaseEntitlement\(entitlement.entitlements, purchase, verifiedPurchase\)/)
  assert.match(ios, /if \(!verifiedPurchase\) return items/)
})

const vm = await import('node:vm')
function workerEnvironment() {
  const handlers = {}, deleted = [], opened = []
  const current = 'coach-fit-pro-subscription-copy-clean-build15-20261103'
  const env = {
    URL, Response,
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => { handlers[name] = fn }, clients: { claim: async () => {} } },
    caches: {
      keys: async () => [current, 'coach-fit-pro-ios-intro-offer-build12-20261102', 'coach-fit-pro-old', 'fit-coach-app-v2', 'another-app-cache'],
      delete: async key => { deleted.push(key); return true },
      match: async () => { throw Error('Global cache lookup must never be used') },
      open: async key => { opened.push(key); return { match: async () => new Response('current-build'), put: async () => {} } },
    },
    fetch: async () => { throw Error('network unavailable') },
  }
  vm.runInNewContext(read('public/service-worker.js'), env)
  return { handlers, deleted, opened, current }
}
test('Service worker removes its known old caches without erasing other apps', async () => {
  const w = workerEnvironment()
  let wait
  w.handlers.activate({ waitUntil: promise => { wait = promise } })
  await wait
  assert.deepEqual(w.deleted.sort(), ['coach-fit-pro-ios-intro-offer-build12-20261102', 'coach-fit-pro-old', 'fit-coach-app-v2'])
})
test('Offline HTML and assets read only the current build cache, never global legacy cache', async () => {
  for (const mode of ['navigate', 'cors']) {
    const w = workerEnvironment()
    let response
    w.handlers.fetch({ request: { method: 'GET', mode, url: 'https://example.test/'+(mode === 'navigate' ? '' : 'assets/index.js'), headers: { has: () => false } }, respondWith: promise => { response = promise }, waitUntil: () => {} })
    assert.equal(await (await response).text(), 'current-build')
    assert.ok(w.opened.every(key => key === w.current))
  }
})
