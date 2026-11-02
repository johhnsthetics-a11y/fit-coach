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
  assert.match(source, /\.appAccountToken\(accountToken\)/)
  assert.match(source, /transaction\.appAccountToken == accountToken/)
})

test('iOS uses an isolated Apple-priced subscription view while web keeps Cartpanda', () => {
  const source = read('src/App.jsx')
  const native = read('src/NativeIosSubscriptionPanel.jsx')
  const pricing = read('src/iosProductPresentation.js')

  assert.match(source, /isNativeIosApp\(\)/)
  assert.match(source, /<NativeIosSubscriptionPanel/)
  assert.match(source, /cartpandaCheckoutPlans/)
  assert.match(native, /loadIosProducts\(/)
  assert.match(native, /restoreIosPurchases\(/)
  assert.match(native, /buildIosSubscriptionCards\(/)
  assert.match(native, /purchaseIosPlan\(/)
  assert.match(native, /purchaseIosPlan\(plan\.planId, accountId\)/)
  assert.match(native, /restoreIosPurchases\(accountId\)/)
  assert.match(native, /Restaurar compras/)
  assert.match(source, /getIosEntitlements\(data\.session\.user\.id\)/)
  assert.match(source, /nativeIosAccess\.accountId === data\.session\.user\.id/)
  assert.doesNotMatch(native, /href=\{.*checkoutUrl/)
  assert.match(pricing, /displayPrice/)
  assert.doesNotMatch(pricing, /R\$\s*[0-9]|US\$\s*[0-9]/)
})

test('native student payment screen blocks external checkout and keeps web checkout', () => {
  const source = read('src/App.jsx')
  const native = read('src/NativeIosSubscriptionPanel.jsx')
  const styles = read('src/nativeIosSubscription.css')

  assert.match(source, /lockState\?\.canOpenCheckout && !nativeIosApp/)
  assert.match(source, /if \(isNativeIosApp\(\)\) \{\s*throw new Error\('O pagamento externo/)
  assert.match(source, /const isLoginRoute = nativeIosApp \|\|/)
  assert.match(styles, /\.native-ios-entry main > :not\(#acesso\)/)
  assert.match(native, /pol[ií]tica-de-privacidade/i)
  assert.match(native, /termos-de-uso/)
  assert.doesNotMatch(native, /checkoutUrl/)
})

test('Native subscription CTA uses green accessible styling and discloses Apple currency', () => {
  const panel = read('src/NativeIosSubscriptionPanel.jsx')
  const css = read('src/nativeIosSubscription.css')
  const pricing = read('src/iosProductPresentation.js')
  const swift = read('plugins/coachfit-storekit/ios/Sources/CoachFitStoreKit/CoachFitStoreKitPlugin.swift')
  const app = read('src/App.jsx')

  assert.match(panel, /className="native-ios-purchase-button"/)
  assert.match(panel, /'Aguarde\.\.\.' : \`Assinar \$\{plan\.title\}\`/)
  assert.doesNotMatch(panel, /Conferir preço e assinar/)
  assert.match(panel, /native-ios-price-details/)
  assert.match(panel, /native-ios-price-disclaimer/)
  assert.match(read('src/iosBrazilPlanPriceReference.js'), /Primeiro mês/)
  assert.match(css, /native-ios-price-period/)
  assert.match(pricing, /IOS_BRAZIL_PLAN_PRICE_REFERENCE/)
  assert.match(css, /\.native-ios-subscription-panel \.native-ios-purchase-button/)
  assert.match(css, /background: #22d7ad/)
  assert.match(css, /color: #052b23/)
  assert.match(panel, /currencyMismatch/)
  assert.doesNotMatch(panel, /Preço disponível para confirmação na App Store/)
  assert.doesNotMatch(panel, /Região informada pelo StoreKit|TestFlight|moeda diferente|dados inconsistentes/)
  assert.match(panel, /Assinar \$\{plan\.title\}/)
  assert.match(panel, /A oferta mensal de R\$ 9,90/)
  assert.match(panel, /loadIosProducts\(\)/)
  assert.match(panel, /document\.addEventListener\('visibilitychange'/)
  assert.match(panel, /current\.displayPrice !== previous\?\.displayPrice/)
  assert.match(swift, /product\.priceFormatStyle\.currencyCode/)
  assert.match(swift, /Storefront\.current/)
  assert.match(swift, /storefrontCountryCode/)
  assert.match(read('src/iosStoreKit.js'), /storefrontCountryCode/)
  assert.match(pricing, /currencyCode/)
  assert.match(app, /isNativeIosApp\(\)\s*\? 'Para liberar o painel no iPhone/)
  assert.doesNotMatch(panel, /replace\(['"]US\$|replaceAll\(['"]US\$/)
})
