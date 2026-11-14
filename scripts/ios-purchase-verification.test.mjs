import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { canStartNativeSubscriptionPurchase, isVerifiedIosSubscriptionPurchase } from '../src/iosPurchaseVerification.js'

const id = 'ba7b4377-b2b4-4b4e-9182-67137a2bbcc0'
const productId = 'br.com.coachfitpro.ios.profissional.mensal'
const now = Date.parse('2026-11-02T15:00:00Z')
const verified = {
  purchased: true,
  verified: true,
  cancelled: false,
  pending: false,
  transaction: {
    id: '12345',
    productId,
    accountId: id,
    expirationDate: '2026-12-02T15:00:00Z',
  },
}

test('Verified live Apple monthly subscription unlocks linked account', () => {
  assert.equal(isVerifiedIosSubscriptionPurchase(verified, id, productId, now), true)
})

test('A valid Apple purchase cannot unlock a different account or product', () => {
  assert.equal(isVerifiedIosSubscriptionPurchase(verified, 'f7d3c831-e32a-4d8f-aa8c-15f47d6d99a4', productId, now), false)
  assert.equal(isVerifiedIosSubscriptionPurchase(verified, id, 'br.com.coachfitpro.ios.profissional.anual', now), false)
})

test('Payment button, incomplete reply, and unverified transaction cannot unlock account', () => {
  for (const payload of [
    undefined, {}, { purchased: true }, { ...verified, verified: false },
    { ...verified, transaction: { ...verified.transaction, id: '' } },
    { ...verified, pending: true },
    { ...verified, cancelled: true },
    { ...verified, purchased: false },
  ]) assert.equal(isVerifiedIosSubscriptionPurchase(payload, id, productId, now), false)
})

test('Expired or non-expiring proof cannot unlock professional tools', () => {
  for (const expirationDate of ['2026-10-30T00:00:00Z', '', null, 'invalid-date']) {
    const payload = { ...verified, transaction: { ...verified.transaction, expirationDate } }
    assert.equal(isVerifiedIosSubscriptionPurchase(payload, id, productId, now), false)
  }
})

test('Native purchase waits for a successful Apple entitlement check before enabling the CTA', () => {
  const ready = {
    accountValid: true, entitlementStatus: 'ready', purchaseAvailable: true, productAvailable: true,
    hasAccess: false, loadingProducts: false, processing: false, pendingPlan: false, operationInFlight: false,
  }
  assert.equal(canStartNativeSubscriptionPurchase(ready), true)
  assert.equal(canStartNativeSubscriptionPurchase({ ...ready, entitlementStatus: 'loading' }), false)
  assert.equal(canStartNativeSubscriptionPurchase({ ...ready, entitlementStatus: 'error' }), false)
  assert.equal(canStartNativeSubscriptionPurchase({ ...ready, hasAccess: true }), false)
  assert.equal(canStartNativeSubscriptionPurchase({ ...ready, loadingProducts: true }), false)
  assert.equal(canStartNativeSubscriptionPurchase({ ...ready, pendingPlan: true }), false)
})

test('Panel sends the selected available StoreKit product to native purchase and blocks missing products', () => {
  const panel = fs.readFileSync(new URL('../src/NativeIosSubscriptionPanel.jsx', import.meta.url), 'utf8')
  const clickStart = panel.indexOf('async function purchase(plan)')
  const restoreStart = panel.indexOf('async function restore()', clickStart)
  assert.ok(clickStart >= 0 && restoreStart > clickStart)
  const click = panel.slice(clickStart, restoreStart)
  assert.match(click, /await purchaseIosPlan\(plan\.planId, accountId, currentDisplayedProduct\)/)
  assert.doesNotMatch(click, /await loadIosProducts\(\)/)
  assert.match(panel, /const canPurchase = canStartNativeSubscriptionPurchase\(/)
  assert.match(panel, /entitlementStatus: accountSnapshot\.status/)
  assert.match(panel, /setMessage\(result\.alreadyActive/)
  assert.match(panel, /Verificando assinatura…/)
  assert.match(panel, /disabled=\{Boolean\(processing\) \|\| Boolean\(pendingPlanId\) \|\| !plan\.purchaseAvailable\}/)
  assert.match(panel, /Este ciclo não foi carregado pela App Store/)
  assert.match(panel, /selectedPlan\.purchaseBlockReason/)
  assert.match(panel, /disabled=\{!canPurchase\}/)
})

test('Signed Apple purchase returns verified account-bound proof and rejects expired subscriptions', () => {
  const swift = fs.readFileSync(new URL('../plugins/coachfit-storekit/ios/Sources/CoachFitStoreKit/CoachFitStoreKitPlugin.swift', import.meta.url), 'utf8')
  assert.match(swift, /case \.verified\(let transaction\)/)
  assert.match(swift, /transaction\.appAccountToken == accountToken/)
  assert.match(swift, /transaction\.productID == productId/)
  assert.match(swift, /transaction\.revocationDate == nil/)
  assert.match(swift, /let expiry = transaction\.expirationDate/)
  assert.match(swift, /expiry\.map \{ \$0 > Date\(\) \}/)
  assert.match(swift, /currentEntitlement\(for: productId, accountToken: accountToken\)/)
  assert.match(swift, /"verified": true/)
})

test('Verified purchases navigate to workspace and protect short entitlement propagation races', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const ios = fs.readFileSync(new URL('../src/iosStoreKit.js', import.meta.url), 'utf8')
  assert.match(app, /handleVerifiedIosSubscription = useCallback/)
  assert.match(app, /const wasAlreadyActive = professionalAccessActive \|\| nativeIosEntitlement/)
  assert.match(app, /recentVerifiedIosPurchaseUntil\.current = Date\.now\(\) \+ 25_000/)
  assert.match(app, /if \(wasAlreadyActive\) \{\s*setActiveView\('visao'\)/)
  assert.match(app, /return runProfessionalActivation\(\{ source: 'apple' \}\)/)
  assert.match(app, /onNativeEntitlementChange=\{handleVerifiedIosSubscription\}/)
  assert.match(app, /previousNativeIosEntitlement\.current/)
  assert.match(ios, /entitlement\.active \|\| verifiedPurchase/)
  assert.match(ios, /isVerifiedIosSubscriptionPurchase\(purchase, id, productId\)/)
})

test('Sandbox entitlements cannot be transferred to a newly created Coach Fit account', () => {
  const swift = fs.readFileSync(new URL('../plugins/coachfit-storekit/ios/Sources/CoachFitStoreKit/CoachFitStoreKitPlugin.swift', import.meta.url), 'utf8')
  const bridge = fs.readFileSync(new URL('../src/iosStoreKit.js', import.meta.url), 'utf8')
  assert.match(swift, /guard transactionAccountToken == accountToken else/)
  assert.match(swift, /guard transaction.appAccountToken == accountToken else \{ continue \}/)
  assert.doesNotMatch(swift, /sandboxSession|testSessionAccess|testAccount/)
  assert.doesNotMatch(swift, /\|\| isSandboxTransaction\(transaction\)/)
  assert.match(bridge, /restorePurchases\(\{ accountId: id \}\)/)
})
