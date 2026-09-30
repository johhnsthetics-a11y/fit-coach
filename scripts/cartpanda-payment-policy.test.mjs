import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isConfirmedCartpandaPayment,
  mapCartpandaSubscriptionStatus,
  parseAllowedCents,
  parseAllowedIds,
  validateStudentPayment,
} from '../supabase/functions/cartpanda-webhook/cartpandaPaymentPolicy.mjs'

test('normalizes configured product ids and amounts', () => {
  assert.deepEqual(parseAllowedIds(' 4664, abc ,4664 '), new Set(['4664', 'abc']))
  assert.deepEqual(parseAllowedCents('2500, 2990,invalid,-1'), new Set([2500, 2990]))
})

test('rejects activation when secure payment configuration is absent', () => {
  assert.deepEqual(validateStudentPayment({ orderId: 'order-1', productId: '4664', amountCents: 2500 }, {
    productIds: new Set(),
    amounts: new Set(),
  }), { ok: false, reason: 'configuration_missing' })
})

test('rejects missing order, unexpected product and unexpected amount', () => {
  const config = { productIds: new Set(['4664']), amounts: new Set([2500]) }
  assert.equal(validateStudentPayment({ orderId: '', productId: '4664', amountCents: 2500 }, config).reason, 'order_missing')
  assert.equal(validateStudentPayment({ orderId: 'order-1', productId: 'other', amountCents: 2500 }, config).reason, 'product_mismatch')
  assert.equal(validateStudentPayment({ orderId: 'order-1', productId: '4664', amountCents: 990 }, config).reason, 'amount_mismatch')
})

test('accepts only an exact configured payment', () => {
  assert.deepEqual(validateStudentPayment({
    orderId: 'order-1',
    productId: '4665',
    amountCents: 2500,
  }, {
    productIds: new Set(['4665']),
    amounts: new Set([2500]),
  }), { ok: true, reason: '' })
})

test('detecta falha de renovacao e exige nova confirmacao para liberar', () => {
  const failedPayload = { payment_status: 'failed', subscription_status: 'past_due' }
  assert.equal(mapCartpandaSubscriptionStatus('subscription_payment_failed', failedPayload), 'past_due')
  assert.equal(isConfirmedCartpandaPayment('subscription_payment_failed', failedPayload), false)

  const paidPayload = { payment_status: 'approved', subscription_status: 'active' }
  assert.equal(mapCartpandaSubscriptionStatus('subscription_payment_approved', paidPayload), 'active')
  assert.equal(isConfirmedCartpandaPayment('subscription_payment_approved', paidPayload), true)
})

test('cancelamento da assinatura permanece estado terminal', () => {
  const payload = { subscription_status: 'canceled' }
  assert.equal(mapCartpandaSubscriptionStatus('subscription_canceled', payload), 'canceled')
  assert.equal(isConfirmedCartpandaPayment('subscription_canceled', payload), false)
})
