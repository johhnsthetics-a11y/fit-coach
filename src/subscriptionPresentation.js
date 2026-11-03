import { isSubscriptionCurrent } from './studentAccess.js'

export const SUBSCRIPTION_CYCLES = Object.freeze({
  mensal: { title: 'Mensal', cycle: '1 mês', charge: 'por mês' },
  semestral: { title: 'Semestral', cycle: '6 meses', charge: 'a cada 6 meses' },
  anual: { title: 'Anual', cycle: '12 meses', charge: 'por ano' },
})

export function validSubscriptionDate(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : ''
}

export function formatSubscriptionDate(value) {
  const date = validSubscriptionDate(value)
  if (!date) return 'Não informado pelo provedor'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function formatVerifiedAppleAmount(transaction) {
  const price = transaction?.transactionPrice
  const currency = transaction?.transactionCurrencyCode
  if (typeof price !== 'string' || !/^\d+(?:\.\d+)?$/.test(price)
    || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return ''
  const amount = Number(price)
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) return ''
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount) }
  catch { return '' }
}

// Presentation only. Trust only Apple's verified account-bound active entitlements.
export function getVerifiedIosSubscription(entitlements, accountId, productIds, now = Date.now()) {
  const id = String(accountId || '').trim().toLowerCase()
  if (!id || !Array.isArray(entitlements)) return null
  const planByProductId = Object.fromEntries(Object.entries(productIds).map(([planId, productId]) => [productId, planId]))
  const verified = entitlements.filter(item => {
    if (!item || item.active !== true || item.revoked === true) return false
    if (String(item.accountId || '').toLowerCase() !== id || !planByProductId[item.productId]) return false
    // Subscriptions have an expiration date; never treat incomplete proofs as active.
    if (!validSubscriptionDate(item.expirationDate) || Date.parse(item.expirationDate) <= now) return false
    return true
  }).sort((a, b) => (Date.parse(b.purchaseDate) || 0) - (Date.parse(a.purchaseDate) || 0))
  if (!verified.length) return null
  const transaction = verified[0]
  const planId = planByProductId[transaction.productId]
  return { planId, ...SUBSCRIPTION_CYCLES[planId], productId: transaction.productId,
    purchaseDate: validSubscriptionDate(transaction.purchaseDate),
    transactionAmount: formatVerifiedAppleAmount(transaction),
    appliedOfferType: ['introductory', 'none', 'other'].includes(transaction.appliedOfferType) ? transaction.appliedOfferType : 'unknown',
    expiresAt: validSubscriptionDate(transaction.expirationDate), provider: 'App Store' }
}

// Calendar cycles come from confirmed backend periods, never local plan selections.
export function getConfirmedWebCycle(subscription) {
  const start = validSubscriptionDate(subscription?.currentPeriodStartedAt)
  const end = validSubscriptionDate(subscription?.currentPeriodEndsAt)
  if (!start || !end || Date.parse(end) <= Date.parse(start)) return ''
  const date = new Date(start)
  for (const [planId, months] of [['mensal', 1], ['semestral', 6], ['anual', 12]]) {
    const target = new Date(date)
    target.setUTCDate(1)
    target.setUTCMonth(target.getUTCMonth() + months)
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    target.setUTCDate(Math.min(date.getUTCDate(), lastDay))
    if (Math.abs(target.getTime() - Date.parse(end)) <= 1000) return planId
  }
  return ''
}

export function getWebSubscriptionSummary(subscription, { affiliate = false, now = Date.now() } = {}) {
  const active = isSubscriptionCurrent(subscription, now)
  if (affiliate && !active) return {
    active: true, status: 'Acesso profissional', title: 'Conta com acesso liberado',
    cycle: 'Sem ciclo de cobrança informado', provider: 'Programa profissional', expiresAt: '', planId: '',
    note: 'Este acesso não representa uma assinatura paga pela App Store.',
  }
  const planId = getConfirmedWebCycle(subscription)
  const plan = SUBSCRIPTION_CYCLES[planId]
  const expiresAt = validSubscriptionDate(subscription?.currentPeriodEndsAt)
  const status = String(subscription?.status || '').toLowerCase()
  const expired = expiresAt && Date.parse(expiresAt) <= now
  const provider = subscription?.provider === 'cartpanda' ? 'Checkout web'
    : ['apple','appstore','app_store','storekit'].includes(subscription?.provider) ? 'App Store' : 'Conta Coach Fit Pro'
  return {
    active,
    status: active ? 'Ativa' : expired ? 'Período encerrado'
      : ['cancelled', 'canceled', 'cancelado'].includes(status) ? 'Cancelada'
        : ['pending', 'trial', 'waiting_payment', 'pendente'].includes(status) ? 'Aguardando pagamento'
          : 'Sem assinatura ativa',
    title: active ? (plan ? `Plano ${plan.title}` : 'Assinatura profissional ativa') : 'Escolha seu plano',
    planId: active ? planId : '',
    cycle: plan?.cycle || 'Ciclo não informado',
    provider, expiresAt,
    startedAt: validSubscriptionDate(subscription?.currentPeriodStartedAt),
    paidAt: validSubscriptionDate(subscription?.paidAt),
    note: plan ? 'Ciclo identificado pelo período de acesso confirmado no pagamento.'
      : active ? 'O acesso está confirmado, mas o provedor não informou o ciclo contratado.'
        : 'Escolher um plano não ativa a assinatura. O acesso depende da confirmação do pagamento.',
  }
}

export function getSafeSubscriptionCheckoutUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
