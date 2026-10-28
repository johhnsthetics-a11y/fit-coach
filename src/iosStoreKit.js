import { Capacitor, registerPlugin } from '@capacitor/core'

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
  return (result.products ?? []).map((product) => ({
    ...product,
    planId: planByProductId[product.id] ?? '',
  }))
}

export async function getIosEntitlements() {
  if (!isNativeIosApp()) return { active: false, entitlements: [] }
  const result = await CoachFitStoreKit.getEntitlements({ productIds: Object.values(IOS_PRODUCT_IDS) })
  const entitlements = result.entitlements ?? []
  return {
    active: entitlements.some((item) => item.active && planByProductId[item.productId]),
    entitlements,
  }
}

export async function purchaseIosPlan(planId) {
  requireNativeIos()
  const productId = IOS_PRODUCT_IDS[planId]
  if (!productId) throw new Error('Plano da App Store inválido.')

  const purchase = await CoachFitStoreKit.purchase({ productId })
  if (purchase.cancelled || purchase.pending) return purchase
  const entitlement = await getIosEntitlements()
  return { ...purchase, active: entitlement.active, entitlements: entitlement.entitlements }
}

export async function restoreIosPurchases() {
  requireNativeIos()
  await CoachFitStoreKit.restorePurchases()
  return getIosEntitlements()
}
