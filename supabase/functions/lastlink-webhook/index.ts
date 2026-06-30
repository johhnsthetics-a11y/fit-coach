const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token, x-lastlink-token, x-lastlink-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_TOKEN = Deno.env.get('LASTLINK_WEBHOOK_TOKEN') ?? ''

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true }, 200)
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBHOOK_TOKEN) {
    return jsonResponse({ ok: false, error: 'Webhook environment not configured' }, 500)
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400)
  }

  if (!isAuthorized(request, payload)) {
    return jsonResponse({ ok: false, error: 'Unauthorized webhook' }, 401)
  }

  const eventType = findString(payload, ['event', 'event_type', 'type', 'status', 'transaction_status'])
  const buyerEmail = normalizeEmail(findString(payload, ['email', 'buyer_email', 'customer_email', 'client_email', 'payer_email']))
  const orderId = findString(payload, ['order_id', 'purchase_id', 'transaction_id', 'payment_id', 'sale_id'])
  const subscriptionId = findString(payload, ['subscription_id', 'plan_subscription_id', 'recurrence_id'])
  const eventId = findString(payload, ['id', 'event_id', 'webhook_id']) || [eventType, orderId, subscriptionId, buyerEmail, Date.now()].filter(Boolean).join(':')
  const status = mapSubscriptionStatus(eventType, payload)

  await saveWebhookEvent({
    eventId,
    eventType,
    buyerEmail,
    orderId,
    subscriptionId,
    status,
    payload,
    processed: false,
  })

  if (!buyerEmail) {
    await markWebhookError(eventId, 'Buyer email not found in Lastlink payload')
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
  })

  await markWebhookProcessed(eventId)
  return jsonResponse({ ok: true, processed: true, coachId: user.id, status }, 200)
})

function isAuthorized(request: Request, payload: Record<string, unknown>) {
  const url = new URL(request.url)
  const candidates = [
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
    request.headers.get('x-webhook-token'),
    request.headers.get('x-lastlink-token'),
    request.headers.get('x-lastlink-signature'),
    url.searchParams.get('token'),
    findString(payload, ['token', 'webhook_token', 'secret', 'signature']),
  ].filter(Boolean)

  return candidates.some((candidate) => candidate === WEBHOOK_TOKEN)
}

function mapSubscriptionStatus(eventType: string, payload: Record<string, unknown>) {
  const haystack = [
    eventType,
    findString(payload, ['payment_status', 'status', 'transaction_status', 'subscription_status']),
  ].join(' ').toLowerCase()

  if (/(chargeback|contest)/.test(haystack)) return 'chargeback'
  if (/(refund|reembolso|refunded)/.test(haystack)) return 'refunded'
  if (/(cancel|canceled|cancelado|cancelled)/.test(haystack)) return 'canceled'
  if (/(fail|failed|recus|declin|denied|overdue|past_due|atras)/.test(haystack)) return 'past_due'
  if (/(paid|approved|aprov|complete|completed|active|confirm)/.test(haystack)) return 'active'
  return 'pending'
}

async function saveWebhookEvent(event: {
  eventId: string
  eventType: string
  buyerEmail: string
  orderId: string
  subscriptionId: string
  status: string
  payload: Record<string, unknown>
  processed: boolean
}) {
  await supabaseFetch('/rest/v1/lastlink_webhook_events?on_conflict=event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      event_id: event.eventId,
      event_type: event.eventType,
      buyer_email: event.buyerEmail,
      provider_order_id: event.orderId,
      provider_subscription_id: event.subscriptionId,
      subscription_status: event.status,
      processed: event.processed,
      payload: event.payload,
    }),
  })
}

async function findUserByEmail(email: string) {
  const rows = await supabaseFetch(`/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email&limit=1`)
  return Array.isArray(rows) ? rows[0] : null
}

async function updateCoachSubscription(input: {
  coachId: string
  status: string
  orderId: string
  subscriptionId: string
}) {
  const now = new Date()
  const nextMonth = new Date(now)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  const activePayload = input.status === 'active'
    ? {
        paid_at: now.toISOString(),
        current_period_started_at: now.toISOString(),
        current_period_ends_at: nextMonth.toISOString(),
        next_billing_at: nextMonth.toISOString(),
      }
    : {}

  await supabaseFetch('/rest/v1/coach_subscriptions?on_conflict=coach_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      coach_id: input.coachId,
      status: input.status,
      provider: 'lastlink',
      provider_order_id: input.orderId || null,
      provider_subscription_id: input.subscriptionId || null,
      updated_at: now.toISOString(),
      ...activePayload,
    }),
  })
}

async function markWebhookProcessed(eventId: string) {
  await supabaseFetch(`/rest/v1/lastlink_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ processed: true, processing_error: null }),
  })
}

async function markWebhookError(eventId: string, error: string) {
  await supabaseFetch(`/rest/v1/lastlink_webhook_events?event_id=eq.${encodeURIComponent(eventId)}`, {
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
