import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const productIds = [
  'br.com.coachfitpro.ios.profissional.mensal',
  'br.com.coachfitpro.ios.profissional.semestral',
  'br.com.coachfitpro.ios.profissional.anual',
]

test('Capacitor uses the App Store bundle identifier and local StoreKit plugin', () => {
  const config = JSON.parse(read('capacitor.config.json'))
  const pkg = JSON.parse(read('package.json'))

  assert.equal(config.appId, 'br.com.coachfitpro.ios')
  assert.equal(config.webDir, 'dist')
  assert.equal(pkg.dependencies['@capacitor/core'], '8.5.3')
  assert.equal(pkg.dependencies['@capacitor/ios'], '8.5.3')
  assert.equal(pkg.dependencies['@coachfit/storekit'], 'file:plugins/coachfit-storekit')
  assert.equal(pkg.devDependencies['@capacitor/cli'], '8.5.3')
})

test('JavaScript bridge exposes purchase, restore, and entitlement checks only on native iOS', () => {
  const source = read('src/iosStoreKit.js')

  productIds.forEach((id) => assert.match(source, new RegExp(id.replaceAll('.', '\\.'))))
  assert.match(source, /Capacitor\.isNativePlatform\(\)/)
  assert.match(source, /Capacitor\.getPlatform\(\) === 'ios'/)
  assert.match(source, /getProducts/)
  assert.match(source, /purchase/)
  assert.match(source, /restorePurchases/)
  assert.match(source, /getEntitlements/)
})

test('Swift StoreKit plugin verifies transactions and supports restore', () => {
  const source = read('plugins/coachfit-storekit/ios/Sources/CoachFitStoreKit/CoachFitStoreKitPlugin.swift')

  assert.match(source, /import StoreKit/)
  assert.match(source, /CAPBridgedPlugin/)
  assert.match(source, /Product\.products/)
  assert.match(source, /Transaction\.currentEntitlements/)
  assert.match(source, /AppStore\.sync\(\)/)
  assert.match(source, /case \.verified/)
  assert.match(source, /await transaction\.finish\(\)/)
})

test('professional access gate and subscription screen recognize native Apple entitlement', () => {
  const source = read('src/App.jsx')

  assert.match(source, /nativeIosEntitlement/)
  assert.match(source, /coachSubscriptionActive \|\| professionalAffiliate \|\| nativeIosEntitlement/)
  assert.match(source, /onNativeEntitlementChange/)
  assert.match(source, /Restaurar compras/)
  assert.match(source, /purchaseIosPlan/)
})
