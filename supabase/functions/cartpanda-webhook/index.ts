const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token, x-cartpanda-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_TOKEN = Deno.env.get('CARTPANDA_WEBHOOK_TOKEN') ?? Deno.env.get('LASTLINK_WEBHOOK_TOKEN') ?? ''

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true }, 200)
  }

  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBHOOK_TOKEN) {
    return jsonResponse({ ok: false, error: 'Webhook environment not configured' }, 500)
  }

  const payload = await readPayload(request)

  if (!isAuthorized(request, payload)) {
    return jsonResponse({ ok: false, error: 'Unauthorized webhook' }, 401)
  }

  const eventType = findString(payload, ['event', 'event_type', 'type', 'order_type', 'status', 'payment_status']) || 'cartpanda_postback'
  const buyerEmail = normalizeEmail(findString(payload, ['email', 'buyer_email', 'customer_email', 'client_email', 'payer_email']))
  const correlationId = findString(payload, ['cid', 'click_id', 'campaignkey'])
  const orderId = findString(payload, ['order_id', 'id', 'purchase_id', 'transaction_id', 'payment_id', 'sale_id'])
  const productId = findString(payload, ['product_id', 'offer_id', 'plan_id'])
  const productName = findString(payload, ['product_name', 'offer_name', 'plan_name', 'name'])
  const providerSubscriptionId = findString(payload, ['subscription_id', 'plan_subscription_id', 'recurrence_id'])
  const subscriptionId = providerSubscriptionId || productId
  const amountCents = parseMoneyToCents(findValue(payload, ['total_price', 'amount', 'amount_net', 'price', 'value']))
  const status = mapSubscriptionStatus(eventType, payload)
  const providerEventAt = resolveProviderEventAt(payload)
  const explicitEventId = findString(payload, ['event_id', 'webhook_id'])
  const eventId = explicitEventId || await buildStableEventId({
    eventType,
    status,
    orderId,
    subscriptionId,
    correlationId,
    buyerEmail,
    productId,
    amountCents,
    providerEventAt,
    payload,
  })
  const authMethod = resolveAuthMethod(request, payload)

  auditLog('webhook_received', {
    eventId,
    eventType,
    status,
    orderId,
    correlation: Boolean(correlationId),
    providerEventAt,
  })

  if (await findProcessedWebhookEvent(eventId)) {
    auditLog('duplicate_event', { eventId, orderId, status })
    return jsonResponse({ ok: true, processed: true, reason: 'duplicate_event' }, 200)
  }

  await saveWebhookEvent({
    eventId,
    eventType,
    buyerEmail,
    orderId,
    subscriptionId,
    productId,
    productName,
    amountCents,
    status,
    correlationId,
    authMethod,
    providerEventAt,
    payload,
    processed: false,
  })

  const checkoutSession = correlationId
    ? await findStudentCheckoutSession(correlationId)
    : providerSubscriptionId
      ? await findStudentCheckoutSessionByProviderSubscription(providerSubscriptionId)
      : null

  if (correlationId || checkoutSession) {
    if (!checkoutSession?.student_id) {
      await markWebhookError(eventId, 'Student checkout token not found or expired')
      return jsonResponse({ ok: true, processed: false, reason: 'student_checkout_not_found' }, 202)
    }

    const confirmedPayment = isConfirmedPayment(eventType, payload)
    const safeStatus = status === 'active' && !confirmedPayment ? 'pending' : status
    const decision = shouldApplyStudentEvent({
      currentStatus: checkoutSession.status,
      incomingStatus: safeStatus,
      lastProviderEventAt: checkoutSession.last_provider_event_at,
      providerEventAt,
    })

    if (!decision.apply) {
      await markWebhookProcessed(eventId, decision.reason)
      auditLog('student_event_ignored', {
        eventId,
        orderId,
        studentId: checkoutSession.student_id,
        currentStatus: checkoutSession.status,
        incomingStatus: safeStatus,
        reason: decision.reason,
      })
      return jsonResponse({
        ok: true,
        processed: true,
        reason: decision.reason,
        studentId: checkoutSession.student_id,
        status: checkoutSession.status,
      }, 200)
    }

    await updateStudentCheckoutSession({
      session: checkoutSession,
      eventId,
      providerEventAt,
      status: safeStatus,
      buyerEmail,
      orderId,
      subscriptionId,
      amountCents,
      payload,
    })

    if (safeStatus === 'active' && confirmedPayment) {
      const affiliate = await findActiveAffiliateForCoach(checkoutSession.coach_id)
      if (affiliate?.email) {
        const terms = await loadAffiliateProgramTerms()
        await recordAffiliateStudentPayment({
          eventId,
          coachId: checkoutSession.coach_id,
          studentId: checkoutSession.student_id,
          affiliateEmail: affiliate.email,
          orderId,
          subscriptionId,
          providerAmountCents: amountCents,
          paidAt: providerEventAt || new Date().toISOString(),
          monthlyFeeCents: terms.monthlyFeeCents,
          commissionRate: terms.commissionRate,
        })
        auditLog('affiliate_commission_recorded', {
          eventId,
          coachId: checkoutSession.coach_id,
          studentId: checkoutSession.student_id,
          revenueCents: terms.monthlyFeeCents,
          commissionCents: Math.round(terms.monthlyFeeCents * terms.commissionRate),
        })
      }
    } else if (status === 'refunded' || status === 'chargeback') {
      await reverseAffiliateStudentPayment({
        eventId,
        coachId: checkoutSession.coach_id,
        studentId: checkoutSession.student_id,
        orderId,
        subscriptionId,
        status,
      })
    }

    await markWebhookProcessed(eventId, 'student_event_applied')
    auditLog('student_event_applied', {
      eventId,
      orderId,
      studentId: checkoutSession.student_id,
      coachId: checkoutSession.coach_id,
      status: safeStatus,
    })
    return jsonResponse({ ok: true, processed: true, studentId: checkoutSession.student_id, status: safeStatus }, 200)
  }

  if (!buyerEmail) {
    await markWebhookError(eventId, 'Buyer email not found in Cartpanda payload')
    return jsonResponse({ ok: true, processed: false, reason: 'buyer_email_not_found' }, 202)
  }

  const user = await findUserByEmail(buyerEmail)
  if (!user?.id) {
    await markWebhookError(eventId, `Coach not found for email ${buyerEmail}`)
    return jsonResponse({ ok: true, processed: false, reason: 'coach_not_found' }, 202)
  }

  await updateCoachSubscription({
    coachId: user.id,
    status,
    orderId,
    subscriptionId,
    productId,
    productName,
    amountCents,
    payload,
  })

  await markWebhookProcessed(eventId)
  return jsonResponse({ ok: true, processed: true, coachId: user.id, status }, 200)
})

async function readPayload(request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url)
  const queryPayload = Object.fromEntries(url.searchParams.entries())
  if (request.method !== 'POST') return queryPayload

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  const text = await request.text()
  if (!text.trim()) return queryPayload

  try {
    if (contentType.includes('application/json')) {
      return { ...queryPayload, ...JSON.parse(text) }
    }

    if (contentType.includes('application/x-www-form-urlencoded') || text.includes('=')) {
      return { ...queryPayload, ...Object.fromEntries(new URLSearchParams(text).entries()) }
    }

    return { ...queryPayload, ...JSON.parse(text) }
  } catch {
    return { ...queryPayload, raw_body: text }
  }
}

function isAuthorized(request: Request, payload: Record<string, unknown>) {
  const url = new URL(request.url)
  const candidates = [
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
    request.headers.get('x-webhook-token'),
    request.headers.get('x-cartpanda-token'),
    url.searchParams.get('token'),
    findString(payload, ['token', 'webhook_token', 'secret', 'signature']),
  ].filter(Boolean)

  return candidates.some((candidate) => candidate === WEBHOOK_TOKEN)
}

function mapSubscriptionStatus(eventType: string, payload: Record<string, unknown>) {
  const haystack = [
    eventType,
    findString(payload, ['order_type', 'payment_status', 'status', 'transaction_status', 'subscription_status', 'financial_status']),
  ].join(' ').toLowerCase()

  if (/(chargeback|contest|dispute)/.test(haystack)) return 'chargeback'
  if (/(refund|reembolso|refunded|estorno)/.test(haystack)) return 'refunded'
  if (/(cancel|canceled|cancelado|cancelled)/.test(haystack)) return 'canceled'
  if (/(fail|failed|recus|declin|denied|overdue|past_due|atras|unpaid)/.test(haystack)) return 'past_due'
  if (/(paid|approved|aprov|complete|completed|active|confirm|captured|sale|order)/.test(haystack)) return 'active'

  const hasSaleSignals = Boolean(
    findString(payload, ['order_id', 'id', 'transaction_id'])
    && findString(payload, ['email', 'buyer_email', 'customer_email'])
    && findString(payload, ['product_id', 'product_name'])
  )

  return hasSaleSignals ? 'active' : 'pending'
}

async function saveWebhookEvent(event: {
  eventId: string
  eventType: string
  buyerEmail: string
  orderId: string
  subscriptionId: string
  productId: string
  productName: string
  amountCents: number | null
  status: string
  correlationId: string
  authMethod: string
  providerEventAt: string | null
  payload: Record<string, unknown>
  processed: boolean
}) {
  await supabaseFetch('/rest/v1/payment_webhook_events?on_conflict=event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      provider: 'cartpanda',
      event_id: event.eventId,
      event_type: event.eventType,
      buyer_email: event.buyerEmail,
      provider_order_id: event.orderId,
      provider_subscription_id: event.subscriptionId,
      product_id: event.productId,
      product_name: event.productName,
      amount_cents: event.amountCents,
      subscription_status: event.status,
      correlation_id: event.correlationId || null,
      authenticated: true,
      auth_method: event.authMethod,
      provider_event_at: event.providerEventAt,
      processing_result: 'received',
      processed: event.processed,
      payload: event.payload,
    }),
  })
}

async function findUserByEmail(email: string) {
  const rows = await supabaseFetch(`/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email&limit=1`)
  return Array.isArray(rows) ? rows[0] : null
}

async function loadAffiliateProgramTerms() {
  const rows = await supabaseFetch(
    '/rest/v1/app_admin_settings?key=eq.affiliate_program&select=settings&limit=1',
  )
  const settings = Array.isArray(rows) ? rows[0]?.settings || {} : {}
  const monthlyFeeCents = Number(settings.monthlyFeeCents)
  const commissionRate = Number(settings.commissionRate)
  return {
    monthlyFeeCents: Number.isInteger(monthlyFeeCents) && monthlyFeeCents > 0 ? monthlyFeeCents : 2500,
    commissionRate: Number.isFinite(commissionRate) && commissionRate >= 0 && commissionRate <= 1 ? commissionRate : 0.25,
  }
}

async function findActiveAffiliateForCoach(coachId: string) {
  if (!coachId) return null
  const users = await supabaseFetch(
    `/rest/v1/users?id=eq.${encodeURIComponent(coachId)}&select=id,email&limit=1`,
  )
  const user = Array.isArray(users) ? users[0] : null
  const email = normalizeEmail(user?.email || '')
  if (!email) return null

  const affiliates = await supabaseFetch(
    `/rest/v1/affiliate_professionals?email=eq.${encodeURIComponent(email)}&active=eq.true&select=id,email&limit=1`,
  )
  return Array.isArray(affiliates) ? affiliates[0] : null
}

async function recordAffiliateStudentPayment(input: {
  eventId: string
  coachId: string
  studentId: string
  affiliateEmail: string
  orderId: string
  subscriptionId: string
  providerAmountCents: number | null
  paidAt: string
  monthlyFeeCents: number
  commissionRate: number
}) {
  const paidAt = new Date(input.paidAt)
  const paymentMonth = `${paidAt.getUTCFullYear()}-${String(paidAt.getUTCMonth() + 1).padStart(2, '0')}-01`
  const commissionCents = Math.round(input.monthlyFeeCents * input.commissionRate)

  await supabaseFetch('/rest/v1/affiliate_student_payments?on_conflict=webhook_event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      webhook_event_id: input.eventId,
      coach_id: input.coachId,
      student_id: input.studentId,
      affiliate_email: normalizeEmail(input.affiliateEmail),
      status: 'paid',
      paid_at: paidAt.toISOString(),
      payment_month: paymentMonth,
      revenue_cents: input.monthlyFeeCents,
      provider_amount_cents: input.providerAmountCents,
      commission_rate: input.commissionRate,
      commission_cents: commissionCents,
      provider: 'cartpanda',
      provider_order_id: input.orderId || null,
      provider_subscription_id: input.subscriptionId || null,
      updated_at: paidAt.toISOString(),
    }),
  })
}

async function reverseAffiliateStudentPayment(input: {
  eventId: string
  coachId: string
  studentId: string
  orderId: string
  subscriptionId: string
  status: 'refunded' | 'chargeback'
}) {
  const baseFilter = `coach_id=eq.${encodeURIComponent(input.coachId)}&student_id=eq.${encodeURIComponent(input.studentId)}&status=eq.paid`
  const providerFilter = input.orderId
    ? `provider_order_id=eq.${encodeURIComponent(input.orderId)}`
    : input.subscriptionId
      ? `provider_subscription_id=eq.${encodeURIComponent(input.subscriptionId)}`
      : ''

  if (!providerFilter) return

  const rows = await supabaseFetch(
    `/rest/v1/affiliate_student_payments?${baseFilter}&${providerFilter}&select=id&order=paid_at.desc&limit=1`,
  )
  const payment = Array.isArray(rows) ? rows[0] : null
  if (!payment?.id) return

  const now = new Date().toISOString()
  await supabaseFetch(`/rest/v1/affiliate_student_payments?id=eq.${encodeURIComponent(payment.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: input.status,
      reversal_event_id: input.eventId,
      reversed_at: now,
      updated_at: now,
    }),
  })
}

async function findStudentCheckoutSession(checkoutToken: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutToken)) return null
  const rows = await supabaseFetch(
    `/rest/v1/student_checkout_sessions?checkout_token=eq.${encodeURIComponent(checkoutToken)}&select=id,checkout_token,coach_id,student_id,status,paid_at,provider_subscription_id,last_provider_event_id,last_provider_event_at&limit=1`,
  )
  return Array.isArray(rows) ? rows[0] : null
}

async function findStudentCheckoutSessionByProviderSubscription(subscriptionId: string) {
  if (!subscriptionId) return null
  const rows = await supabaseFetch(
    `/rest/v1/student_checkout_sessions?provider_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id,checkout_token,coach_id,student_id,status,paid_at,provider_subscription_id,last_provider_event_id,last_provider_event_at&order=created_at.desc&limit=1`,
  )
  return Array.isArray(rows) ? rows[0] : null
}

async function updateStudentCheckoutSession(input: {
  session: { checkout_token: string; coach_id: string; student_id: string; paid_at?: string | null }
  eventId: string
  providerEventAt: string | null
  status: string
  buyerEmail: string
  orderId: string
  subscriptionId: string
  amountCents: number | null
  payload: Record<string, unknown>
}) {
  const now = new Date().toISOString()
  const effectiveEventAt = input.providerEventAt || now
  const studentState = await findStudentSubscriptionState(input.session.student_id, input.session.coach_id)
  const periodEndsAt = input.status === 'active'
    ? resolveStudentPeriodEnd(input.payload, effectiveEventAt)
    : studentState?.app_subscription_expires_at || null
  const sessionUpdate: Record<string, unknown> = {
    status: input.status,
    buyer_email: input.buyerEmail || null,
    provider_order_id: input.orderId || null,
    provider_subscription_id: input.subscriptionId || null,
    amount_cents: input.amountCents,
    last_provider_event_id: input.eventId,
    last_provider_event_at: input.providerEventAt,
    updated_at: now,
  }
  if (input.status === 'active') {
    sessionUpdate.paid_at = input.session.paid_at || effectiveEventAt
  }

  await supabaseFetch(`/rest/v1/student_checkout_sessions?checkout_token=eq.${encodeURIComponent(input.session.checkout_token)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(sessionUpdate),
  })

  await supabaseFetch(`/rest/v1/students?id=eq.${encodeURIComponent(input.session.student_id)}&coach_id=eq.${encodeURIComponent(input.session.coach_id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      app_payment_status: input.status,
      app_subscription_started_at: input.status === 'active'
        ? studentState?.app_subscription_started_at || effectiveEventAt
        : studentState?.app_subscription_started_at || null,
      app_subscription_expires_at: periodEndsAt,
      updated_at: now,
    }),
  })
}

async function findStudentSubscriptionState(studentId: string, coachId: string) {
  const rows = await supabaseFetch(
    `/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&coach_id=eq.${encodeURIComponent(coachId)}&select=app_subscription_started_at,app_subscription_expires_at&limit=1`,
  )
  return Array.isArray(rows) ? rows[0] : null
}

async function findProcessedWebhookEvent(eventId: string) {
  if (!eventId) return false
  const rows = await supabaseFetch(
    `/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&processed=eq.true&select=event_id&limit=1`,
  )
  return Array.isArray(rows) && rows.length > 0
}

function resolveStudentPeriodEnd(payload: Record<string, unknown>, nowIso: string) {
  const providerDate = findString(payload, [
    'current_period_ends_at', 'current_period_end', 'next_billing_at', 'next_charge_at',
    'subscription_expires_at', 'expires_at',
  ])
  const parsedProviderDate = Date.parse(providerDate)
  if (Number.isFinite(parsedProviderDate) && parsedProviderDate > Date.parse(nowIso)) {
    return new Date(parsedProviderDate).toISOString()
  }
  return addCalendarMonths(new Date(nowIso), 1).toISOString()
}

function addCalendarMonths(value: Date, months: number) {
  const year = value.getUTCFullYear()
  const month = value.getUTCMonth()
  const day = value.getUTCDate()
  const targetMonthIndex = month + months
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(day, lastDay),
    value.getUTCHours(),
    value.getUTCMinutes(),
    value.getUTCSeconds(),
    value.getUTCMilliseconds(),
  ))
}

async function updateCoachSubscription(input: {
  coachId: string
  status: string
  orderId: string
  subscriptionId: string
  productId: string
  productName: string
  amountCents: number | null
  payload: Record<string, unknown>
}) {
  const now = new Date()
  const months = inferCycleMonths(input.productName, input.productId, input.payload)
  const nextBillingAt = addMonths(now, months)

  const activePayload = input.status === 'active'
    ? {
        paid_at: now.toISOString(),
        current_period_started_at: now.toISOString(),
        current_period_ends_at: nextBillingAt.toISOString(),
        next_billing_at: nextBillingAt.toISOString(),
      }
    : {}

  await supabaseFetch('/rest/v1/coach_subscriptions?on_conflict=coach_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      coach_id: input.coachId,
      status: input.status,
      provider: 'cartpanda',
      provider_order_id: input.orderId || null,
      provider_subscription_id: input.subscriptionId || null,
      updated_at: now.toISOString(),
      ...activePayload,
    }),
  })
}

async function markWebhookProcessed(eventId: string, processingResult = 'processed') {
  await supabaseFetch(`/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ processed: true, processing_error: null, processing_result: processingResult }),
  })
}

async function markWebhookError(eventId: string, error: string) {
  await supabaseFetch(`/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ processed: false, processing_error: error, processing_result: 'error' }),
  })
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Supabase request failed: ${response.status} ${text}`)
  }

  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function inferCycleMonths(productName: string, productId: string, payload: Record<string, unknown>) {
  const haystack = [
    productName,
    productId,
    findString(payload, ['plan_name', 'offer_name', 'description', 'frequency', 'frequency_description']),
  ].join(' ').toLowerCase()

  if (/(anual|annual|12\s*mes|12\s*month|year)/.test(haystack)) return 12
  if (/(semestral|semester|6\s*mes|6\s*month)/.test(haystack)) return 6
  if (/(trimestral|quarter|3\s*mes|3\s*month)/.test(haystack)) return 3
  return 1
}

function addMonths(value: Date, months: number) {
  const result = new Date(value)
  result.setMonth(result.getMonth() + months)
  return result
}

function resolveProviderEventAt(payload: Record<string, unknown>) {
  const raw = findString(payload, [
    'event_created_at',
    'created_at',
    'datetime_full',
    'paid_at',
    'updated_at',
    'processed_at',
  ])
  if (!raw) return null
  const timestamp = Date.parse(raw)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function shouldApplyStudentEvent(input: {
  currentStatus?: string | null
  incomingStatus: string
  lastProviderEventAt?: string | null
  providerEventAt?: string | null
}) {
  const currentStatus = String(input.currentStatus || 'pending')
  const incomingStatus = String(input.incomingStatus || 'pending')
  const currentEventAt = input.lastProviderEventAt ? Date.parse(input.lastProviderEventAt) : Number.NaN
  const incomingEventAt = input.providerEventAt ? Date.parse(input.providerEventAt) : Number.NaN

  if (Number.isFinite(currentEventAt) && Number.isFinite(incomingEventAt) && incomingEventAt < currentEventAt) {
    return { apply: false, reason: 'stale_provider_event' }
  }

  if (['refunded', 'chargeback'].includes(currentStatus)
      && !['refunded', 'chargeback'].includes(incomingStatus)) {
    return { apply: false, reason: 'terminal_state_preserved' }
  }

  if (currentStatus === 'active' && incomingStatus === 'pending') {
    return { apply: false, reason: 'pending_cannot_downgrade_active' }
  }

  if (currentStatus === 'canceled' && incomingStatus === 'pending') {
    return { apply: false, reason: 'pending_cannot_reopen_canceled' }
  }

  return { apply: true, reason: 'applied' }
}

function resolveAuthMethod(request: Request, payload: Record<string, unknown>) {
  const url = new URL(request.url)
  if (request.headers.get('authorization')) return 'authorization_header'
  if (request.headers.get('x-webhook-token')) return 'x_webhook_token'
  if (request.headers.get('x-cartpanda-token')) return 'x_cartpanda_token'
  if (url.searchParams.get('token')) return 'query_token'
  if (findString(payload, ['token', 'webhook_token', 'secret', 'signature'])) return 'payload_token'
  return 'unknown'
}

async function buildStableEventId(input: {
  eventType: string
  status: string
  orderId: string
  subscriptionId: string
  correlationId: string
  buyerEmail: string
  productId: string
  amountCents: number | null
  providerEventAt: string | null
  payload: Record<string, unknown>
}) {
  const fingerprint = {
    provider: 'cartpanda',
    eventType: input.eventType,
    status: input.status,
    orderId: input.orderId,
    subscriptionId: input.subscriptionId,
    correlationId: input.correlationId,
    buyerEmail: input.buyerEmail,
    productId: input.productId,
    amountCents: input.amountCents,
    providerEventAt: input.providerEventAt,
    payload: sanitizeWebhookPayload(input.payload),
  }
  const encoded = new TextEncoder().encode(stableStringify(fingerprint))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `cartpanda:${hash}`
}

function sanitizeWebhookPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeWebhookPayload)
  if (!value || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    if (['token', 'webhook_token', 'secret', 'signature', 'authorization'].includes(normalizeKey(key))) continue
    sanitized[key] = sanitizeWebhookPayload(source[key])
  }
  return sanitized
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(source[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function auditLog(stage: string, data: Record<string, unknown>) {
  console.info(JSON.stringify({
    scope: 'cartpanda_webhook',
    stage,
    ...data,
  }))
}

function isConfirmedPayment(eventType: string, payload: Record<string, unknown>) {
  const haystack = [
    eventType,
    findString(payload, ['order_type', 'payment_status', 'transaction_status', 'financial_status', 'subscription_status', 'status']),
  ].join(' ').toLowerCase()
  return /(paid|approved|aprov|complete|completed|active|confirm|captured|initial_sale)/.test(haystack)
}

function parseMoneyToCents(value: unknown): number | null {
  if (value == null || value === '') return null
  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

function findString(source: unknown, preferredKeys: string[]): string {
  const result = findValue(source, preferredKeys)
  return result == null ? '' : String(result).trim()
}

function findValue(source: unknown, preferredKeys: string[]): unknown {
  if (!source || typeof source !== 'object') return null
  const object = source as Record<string, unknown>
  const normalizedKeys = new Map(Object.keys(object).map((key) => [normalizeKey(key), key]))

  for (const key of preferredKeys) {
    const realKey = normalizedKeys.get(normalizeKey(key))
    if (realKey && object[realKey] != null && object[realKey] !== '') return object[realKey]
  }

  for (const value of Object.values(object)) {
    if (value && typeof value === 'object') {
      const nested = findValue(value, preferredKeys)
      if (nested != null && nested !== '') return nested
    }
  }

  return null
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeEmail(value: string) {
  return value.toLowerCase().trim()
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
    },
  })
}
