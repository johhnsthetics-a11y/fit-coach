// Only signed Apple purchases or current-entitlement proofs acknowledged by
// the native StoreKit bridge can unlock the professional iOS panel. Displayed
// offer prices and a clicked button are never evidence of a purchase.
export function isVerifiedIosSubscriptionPurchase(purchase, accountId, productId, now = Date.now()) {
  const transaction = purchase?.transaction
  const expiresAt = Date.parse(transaction?.expirationDate || '')
  return purchase?.purchased === true
    && purchase?.verified === true
    && purchase?.cancelled !== true
    && purchase?.pending !== true
    && typeof transaction?.id === 'string' && transaction.id.length > 0
    && String(transaction?.accountId || '').toLowerCase() === String(accountId || '').toLowerCase()
    && transaction?.productId === productId
    && ((Number.isFinite(expiresAt) && expiresAt > now) || transaction?.currentEntitlement === true)
}
