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
  const eventId = await resolveWebhookEventId(payload)

  console.info(JSON.stringify({
    event: 'cartpanda_webhook_received',
    eventRef: shortEventRef(eventId),
    eventType,
    status,
    hasCorrelationId: Boolean(correlationId),
    hasOrderId: Boolean(orderId),
    hasSubscriptionId: Boolean(providerSubscriptionId),
  }))

  const checkoutSession = correlationId
    ? await findStudentCheckoutSession(correlationId)
    : providerSubscriptionId
      ? await findStudentCheckoutSessionByProviderSubscription(providerSubscriptionId)
      : null

  if (correlationId || checkoutSession) {
    const confirmedPayment = isConfirmedPayment(eventType, payload)
    const periodEndsAt = status === 'active' && confirmedPayment
      ? resolveStudentPeriodEnd(payload, providerEventAt)
      : null

    const result = await processStudentPaymentEvent({
      eventId,
      eventType,
      correlationId,
      buyerEmail,
      orderId,
      subscriptionId,
      productId,
      productName,
      amountCents,
      status,
      confirmedPayment,
      providerEventAt,
      periodEndsAt,
      payload,
    })

    console.info(JSON.stringify({
      event: 'cartpanda_student_event_processed',
      eventRef: shortEventRef(eventId),
      processed: result?.processed === true,
      reason: result?.reason || 'unknown',
      status: result?.status || status,
      studentId: result?.studentId || null,
      coachId: result?.coachId || null,
    }))

    if (result?.reason === 'student_checkout_not_found' || result?.reason === 'student_not_found') {
      return jsonResponse({ ok: true, processed: false, reason: result.reason }, 202)
    }
    if (result?.reason === 'unexpected_student_amount') {
      return jsonResponse({ ok: false, processed: true, reason: result.reason }, 202)
    }
    return jsonResponse({
      ok: result?.ok !== false,
      processed: result?.processed === true,
      reason: result?.reason || 'processed',
      status: result?.status || status,
    }, 200)
  }

  if (await findProcessedWebhookEvent(eventId)) {
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
    providerEventAt,
    payload,
    processed: false,
  })

  if (!buyerEmail) {
    await markWebhookError(eventId, 'Buyer email not found in Cartpanda payload')
    return jsonResponse({ ok: true, processed: false, reason: 'buyer_email_not_found' }, 202)
  }

  const user = await findUserByEmail(buyerEmail)
  if (!user?.id) {
    await markWebhookError(eventId, 'Coach not found for webhook e-mail')
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
  console.info(JSON.stringify({
    event: 'cartpanda_coach_event_processed',
    eventRef: shortEventRef(eventId),
    coachId: user.id,
    status,
  }))
  return jsonResponse({ ok: true, processed: true, status }, 200)
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
  providerEventAt: string
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
      provider_event_at: event.providerEventAt,
      processed: event.processed,
      payload: event.payload,
    }),
  })
}

async function findUserByEmail(email: string) {
  const rows = await supabaseFetch(`/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email&limit=1`)
  return Array.isArray(rows) ? rows[0] : null
}

async function processStudentPaymentEvent(input: {
  eventId: string
  eventType: string
  correlationId: string
  buyerEmail: string
  orderId: string
  subscriptionId: string
  productId: string
  productName: string
  amountCents: number | null
  status: string
  confirmedPayment: boolean
  providerEventAt: string
  periodEndsAt: string | null
  payload: Record<string, unknown>
}) {
  return supabaseFetch('/rest/v1/rpc/process_cartpanda_student_payment_event', {
    method: 'POST',
    body: JSON.stringify({
      p_event_id: input.eventId,
      p_event_type: input.eventType,
      p_correlation_id: input.correlationId || null,
      p_buyer_email: input.buyerEmail || null,
      p_provider_order_id: input.orderId || null,
      p_provider_subscription_id: input.subscriptionId || null,
      p_product_id: input.productId || null,
      p_product_name: input.productName || null,
      p_amount_cents: input.amountCents,
      p_status: input.status,
      p_confirmed_payment: input.confirmedPayment,
      p_provider_event_at: input.providerEventAt,
      p_period_ends_at: input.periodEndsAt,
      p_payload: input.payload,
    }),
  })
}

function resolveProviderEventAt(payload: Record<string, unknown>) {
  const candidate = findString(payload, [
    'event_created_at', 'created_at', 'datetime_full', 'paid_at', 'payment_date',
    'processed_at', 'updated_at', 'timestamp',
  ])
  if (candidate) {
    const numeric = Number(candidate)
    if (Number.isFinite(numeric) && /^\d{10,13}$/.test(candidate)) {
      const millis = candidate.length === 10 ? numeric * 1000 : numeric
      const parsed = new Date(millis)
      if (Number.isFinite(parsed.getTime())) return parsed.toISOString()
    }
    const parsed = new Date(candidate)
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString()
  }
  return new Date().toISOString()
}

async function resolveWebhookEventId(payload: Record<string, unknown>) {
  const explicit = findString(payload, ['event_id', 'webhook_id'])
  if (explicit) return explicit

  const sanitized = sanitizeWebhookPayloadForFingerprint(payload)
  const canonical = stableStringify(sanitized)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return 'cartpanda:sha256:' + hex
}

function sanitizeWebhookPayloadForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeWebhookPayloadForFingerprint)
  if (!value || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    const normalized = normalizeKey(key)
    if (['token', 'webhooktoken', 'secret', 'signature', 'authorization'].includes(normalized)) continue
    result[key] = sanitizeWebhookPayloadForFingerprint(source[key])
  }
  return result
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return '{' + Object.keys(object).sort()
      .map((key) => JSON.stringify(key) + ':' + stableStringify(object[key]))
      .join(',') + '}'
  }
  const serialized = JSON.stringify(value)
  return serialized === undefined ? 'null' : serialized
}

function shortEventRef(eventId: string) {
  const normalized = String(eventId || '')
  return normalized.length <= 16 ? normalized : normalized.slice(-16)
}

async function findStudentCheckoutSession(checkoutToken: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutToken)) return null
  const rows = await supabaseFetch(
    `/rest/v1/student_checkout_sessions?checkout_token=eq.${encodeURIComponent(checkoutToken)}&select=id,checkout_token,coach_id,student_id,status,paid_at,provider_subscription_id&limit=1`,
  )
  return Array.isArray(rows) ? rows[0] : null
}

async function findStudentCheckoutSessionByProviderSubscription(subscriptionId: string) {
  if (!subscriptionId) return null
  const rows = await supabaseFetch(
    `/rest/v1/student_checkout_sessions?provider_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id,checkout_token,coach_id,student_id,status,paid_at,provider_subscription_id&order=created_at.desc&limit=1`,
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

function resolveStudentPeriodEnd(payload: Record<string, unknown>, eventIso: string) {
  const providerDate = findString(payload, [
    'current_period_ends_at', 'current_period_end', 'next_billing_at', 'next_charge_at',
    'subscription_expires_at', 'expires_at',
  ])
  const parsedProviderDate = Date.parse(providerDate)
  if (Number.isFinite(parsedProviderDate) && parsedProviderDate > Date.parse(eventIso)) {
    return new Date(parsedProviderDate).toISOString()
  }
  return addCalendarMonths(new Date(eventIso), 1).toISOString()
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

async function markWebhookProcessed(eventId: string) {
  await supabaseFetch(`/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ processed: true, processing_error: null }),
  })
}

async function markWebhookError(eventId: string, error: string) {
  await supabaseFetch(`/rest/v1/payment_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ processed: false, processing_error: error }),
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
