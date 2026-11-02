import { Capacitor, registerPlugin } from '@capacitor/core'
import { normalizeIosStorefrontCountryCode } from './iosProductPresentation'

export const IOS_PRODUCT_IDS = Object.freeze({
  mensal: 'br.com.coachfitpro.ios.profissional.mensal',
  semestral: 'br.com.coachfitpro.ios.profissional.semestral',
  anual: 'br.com.coachfitpro.ios.profissional.anual',
})

const planByProductId = Object.fromEntries(
  Object.entries(IOS_PRODUCT_IDS).map(([planId, productId]) => [productId, planId]),
)

const CoachFitStoreKit = registerPlugin('CoachFitStoreKit')

export function isNativeIosApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

function requireNativeIos() {
  if (!isNativeIosApp()) throw new Error('Compras da App Store estão disponíveis somente no aplicativo para iPhone.')
}

export async function loadIosProducts() {
  requireNativeIos()
  const result = await CoachFitStoreKit.getProducts({ productIds: Object.values(IOS_PRODUCT_IDS) })
  const storefrontCountryCode = normalizeIosStorefrontCountryCode(result.storefrontCountryCode)
  return (result.products ?? []).map((product) => ({
    ...product,
    storefrontCountryCode: storefrontCountryCode || normalizeIosStorefrontCountryCode(product.storefrontCountryCode),
    planId: planByProductId[product.id] ?? '',
  }))
}

export function requireCoachAccountId(accountId) {
  const id = String(accountId || '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    throw new Error('Entre na sua conta profissional antes de assinar pela App Store.')
  }
  return id
}

export async function getIosEntitlements(accountId) {
  if (!isNativeIosApp()) return { active: false, entitlements: [] }
  const id = requireCoachAccountId(accountId)
  const result = await CoachFitStoreKit.getEntitlements({ productIds: Object.values(IOS_PRODUCT_IDS), accountId: id })
  const entitlements = result.entitlements ?? []
  return {
    active: entitlements.some((item) => item.active && String(item.accountId || '').toLowerCase() === id && planByProductId[item.productId]),
    entitlements,
  }
}

export async function purchaseIosPlan(planId, accountId) {
  requireNativeIos()
  const id = requireCoachAccountId(accountId)
  const productId = IOS_PRODUCT_IDS[planId]
  if (!productId) throw new Error('Plano da App Store inválido.')

  const purchase = await CoachFitStoreKit.purchase({ productId, accountId: id })
  if (purchase.cancelled || purchase.pending) return purchase
  const entitlement = await getIosEntitlements(id)
  return { ...purchase, active: entitlement.active, entitlements: entitlement.entitlements }
}

export async function restoreIosPurchases(accountId) {
  requireNativeIos()
  const id = requireCoachAccountId(accountId)
  await CoachFitStoreKit.restorePurchases()
  return getIosEntitlements(id)
}
