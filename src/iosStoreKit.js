import { Capacitor, registerPlugin } from '@capacitor/core'
import { normalizeIosStorefrontCountryCode } from './iosProductPresentation'
import { isVerifiedIosSubscriptionPurchase } from './iosPurchaseVerification'
import { getIosPurchaseTermsExpectation } from './iosIntroOffer'
import { syncRemoteAppleSubscriptionEntitlement } from './supabaseApi'

export const IOS_PRODUCT_IDS = Object.freeze({
  mensal: 'br.com.coachfitpro.ios.profissional.mensal',
  semestral: 'br.com.coachfitpro.ios.profissional.semestral',
  anual: 'br.com.coachfitpro.ios.profissional.anual',
})

const planByProductId = Object.fromEntries(
  Object.entries(IOS_PRODUCT_IDS).map(([planId, productId]) => [productId, planId]),
)

const CoachFitStoreKit = registerPlugin('CoachFitStoreKit')
const appleEntitlementSyncsInFlight = new Map()

export function isNativeIosApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

function requireNativeIos() {
  if (!isNativeIosApp()) throw new Error('Compras da App Store estão disponíveis somente no aplicativo para iPhone.')
}

export async function loadIosProducts() {
  requireNativeIos()
  const result = await CoachFitStoreKit.getProducts({ productIds: Object.values(IOS_PRODUCT_IDS) })
  return normalizeIosProducts(result)
}

function normalizeIosProducts(result) {
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
  const activeEntitlements = entitlements.filter((item) => (
    item.active
    && String(item.accountId || '').toLowerCase() === id
    && planByProductId[item.productId]
  ))
  const originalTransactionIds = [...new Set(activeEntitlements
    .map((item) => String(item.originalId || item.originalTransactionId || '').trim())
    .filter((transactionId) => /^[0-9]{1,32}$/.test(transactionId)))]

  for (const originalTransactionId of originalTransactionIds) {
    const syncKey = `${id}:${originalTransactionId}`
    let pendingSync = appleEntitlementSyncsInFlight.get(syncKey)
    if (!pendingSync) {
      pendingSync = syncRemoteAppleSubscriptionEntitlement(originalTransactionId)
        .finally(() => appleEntitlementSyncsInFlight.delete(syncKey))
      appleEntitlementSyncsInFlight.set(syncKey, pendingSync)
    }
    try {
      await pendingSync
    } catch (error) {
      console.warn('A verificação local da App Store foi mantida; a sincronização server-side será repetida.', error?.message)
    }
  }

  return {
    active: activeEntitlements.length > 0,
    entitlements,
  }
}

export async function purchaseIosPlan(planId, accountId, displayedProduct) {
  requireNativeIos()
  const id = requireCoachAccountId(accountId)
  const productId = IOS_PRODUCT_IDS[planId]
  if (!productId) throw new Error('Plano da App Store inválido.')

  const expectedProductTerms = getIosPurchaseTermsExpectation(displayedProduct)
  if (!expectedProductTerms || expectedProductTerms.id !== productId) {
    throw new Error('Atualize os preços da App Store antes de continuar. Nenhuma compra foi iniciada.')
  }
  // Native StoreKit compares a fresh Product with these exact displayed terms.
  // If the quote changed, it returns a refreshed price for the user to review.
  const nativePurchase = await CoachFitStoreKit.purchase({ productId, accountId: id, expectedProductTerms })
  if (nativePurchase.priceChanged) return { ...nativePurchase, products: normalizeIosProducts(nativePurchase) }
  const purchase = nativePurchase
  if (purchase.cancelled || purchase.pending) return purchase
  const verifiedPurchase = isVerifiedIosSubscriptionPurchase(purchase, id, productId)
  const originalTransactionId = String(purchase.transaction?.originalId || purchase.transaction?.originalTransactionId || '').trim()
  if (verifiedPurchase && /^[0-9]{1,32}$/.test(originalTransactionId)) {
    try {
      await syncRemoteAppleSubscriptionEntitlement(originalTransactionId)
    } catch (error) {
      console.warn('A compra foi verificada no dispositivo; a validação server-side será repetida.', error?.message)
    }
  }

  // Current entitlements may lag behind a just-verified StoreKit purchase,
  // particularly on TestFlight. Never lose an already verified transaction
  // solely because the second Apple lookup has not refreshed yet.
  try {
    const entitlement = await getIosEntitlements(id)
    return {
      ...purchase,
      active: entitlement.active || verifiedPurchase,
      entitlements: mergeVerifiedPurchaseEntitlement(entitlement.entitlements, purchase, verifiedPurchase),
      awaitingEntitlementSync: verifiedPurchase && !entitlement.active,
    }
  } catch (error) {
    if (!verifiedPurchase) throw error
    return { ...purchase, active: true,
      entitlements: mergeVerifiedPurchaseEntitlement([], purchase, verifiedPurchase), awaitingEntitlementSync: true }
  }
}

// The plugin has verified the signature, account, product and either a live
// transaction or Apple's current entitlement. Preserve that proof if the
// current-entitlements lookup briefly lags after purchase.
export function mergeVerifiedPurchaseEntitlement(entitlements, purchase, verifiedPurchase) {
  const items = Array.isArray(entitlements) ? entitlements : []
  if (!verifiedPurchase) return items
  const transaction = purchase.transaction
  const others = items.filter(item => item.id !== transaction.id)
  return [{ ...transaction, active: true, revoked: false }, ...others]
}

export async function restoreIosPurchases(accountId) {
  requireNativeIos()
  const id = requireCoachAccountId(accountId)
  await CoachFitStoreKit.restorePurchases({ accountId: id })
  return getIosEntitlements(id)
}
