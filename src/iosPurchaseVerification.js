// Only signed, live subscription purchases acknowledged by our native
// StoreKit bridge can unlock the professional iOS panel. Marketing reference
// prices and a clicked button are never evidence of a purchase.
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
    && Number.isFinite(expiresAt) && expiresAt > now
}
