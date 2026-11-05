import { createClient } from 'npm:@supabase/supabase-js@2.91.0'
import { importPKCS8, SignJWT } from 'npm:jose@6.1.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APNS_AUTH_KEY_P8 = (Deno.env.get('APNS_AUTH_KEY_P8') ?? '').replace(/\\n/g, '\n')
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID') ?? ''
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID') ?? ''
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') ?? ''
const APNS_ENVIRONMENT = Deno.env.get('APNS_ENVIRONMENT') ?? ''
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
let cachedProviderToken = ''
let cachedProviderTokenAt = 0

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: 'Serviço indisponível.' }, 503)
  if (!APNS_AUTH_KEY_P8 || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID || !['sandbox', 'production'].includes(APNS_ENVIRONMENT)) {
    return jsonResponse({ error: 'Notificações ainda não configuradas.' }, 503)
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const messageId = String(body.messageId || '').trim()
  if (!UUID_PATTERN.test(messageId)) return jsonResponse({ error: 'Mensagem inválida.' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const actor = await resolveActor(request, body, admin)
  if (!actor) return jsonResponse({ error: 'Sessão ou convite inválido.' }, 401)

  const { data: message, error: messageError } = await admin
    .from('messages')
    .select('id, coach_id, student_id, sender')
    .eq('id', messageId)
    .maybeSingle()
  if (messageError || !message) return jsonResponse({ error: 'Mensagem não encontrada.' }, 404)

  if (actor.actorType === 'coach') {
    if (message.sender !== 'coach' || String(message.coach_id) !== actor.id) {
      return jsonResponse({ error: 'A mensagem não pertence a esta sessão.' }, 403)
    }
  } else if (
    message.sender !== 'student'
    || String(message.student_id) !== actor.id
    || String(message.coach_id) !== actor.coachId
  ) {
    return jsonResponse({ error: 'A mensagem não pertence a este convite.' }, 403)
  }

  const recipientType = actor.actorType === 'coach' ? 'student' : 'coach'
  const recipientId = actor.actorType === 'coach' ? String(message.student_id) : String(message.coach_id)
  const claim = await admin.rpc('claim_chat_push_delivery', {
    p_message_id: messageId,
    p_recipient_type: recipientType,
    p_recipient_id: recipientId,
  })
  if (claim.error) return jsonResponse({ error: 'Não foi possível preparar o aviso.' }, 500)
  if (claim.data !== true) return jsonResponse({ ok: true, duplicate: true })

  let devicesQuery = admin.from('chat_push_devices').select('device_token').eq('actor_type', recipientType).eq('active', true)
  devicesQuery = recipientType === 'coach'
    ? devicesQuery.eq('coach_id', recipientId)
    : devicesQuery.eq('student_id', recipientId)
  const { data: devices, error: devicesError } = await devicesQuery
  if (devicesError) {
    await updateDelivery(admin, messageId, 'failed', 'device_lookup_failed')
    return jsonResponse({ error: 'Não foi possível localizar os dispositivos inscritos.' }, 500)
  }
  if (!devices?.length) {
    await updateDelivery(admin, messageId, 'no_devices', null)
    return jsonResponse({ ok: true, delivered: 0 })
  }

  const providerToken = await getProviderToken()
  const host = APNS_ENVIRONMENT === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com'
  const studentId = String(message.student_id)
  const payload = {
    aps: {
      alert: {
        title: 'Nova mensagem',
        body: 'Você recebeu uma mensagem no Coach Fit Pro.',
      },
      sound: 'default',
      'thread-id': `coachfit-chat-${studentId}`,
    },
    event: 'chat_message',
    recipientRole: recipientType,
    studentId,
    url: `/?area=mensagens&student=${encodeURIComponent(studentId)}`,
  }

  let accepted = 0
  let failures = 0
  await Promise.all(devices.map(async ({ device_token: deviceToken }) => {
    try {
      const response = await fetch(`${host}/3/device/${deviceToken}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${providerToken}`,
          'apns-topic': APNS_BUNDLE_ID,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)),
          'apns-collapse-id': `chat-${messageId}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        accepted += 1
        return
      }
      failures += 1
      const responseBody = await response.json().catch(() => ({}))
      if (response.status === 410 || responseBody.reason === 'Unregistered' || responseBody.reason === 'BadDeviceToken') {
        await admin.from('chat_push_devices').delete().eq('device_token', deviceToken)
      }
    } catch {
      failures += 1
    }
  }))

  if (accepted > 0) {
    await updateDelivery(admin, messageId, 'sent', failures ? 'partial_failure' : null)
    return jsonResponse({ ok: true, delivered: accepted, failed: failures })
  }
  await updateDelivery(admin, messageId, 'failed', 'apns_delivery_failed')
  return jsonResponse({ error: 'A Apple não aceitou o aviso para este dispositivo.' }, 502)
})

async function resolveActor(
  request: Request,
  body: Record<string, unknown>,
  admin: ReturnType<typeof createClient>,
) {
  const actorType = body.actorType === 'student' ? 'student' : body.actorType === 'coach' ? 'coach' : ''
  if (!actorType) return null

  if (actorType === 'coach') {
    const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\\s+/i, '').trim()
    if (!accessToken) return null
    const { data, error } = await admin.auth.getUser(accessToken)
    return error || !data?.user?.id ? null : { actorType, id: String(data.user.id), coachId: String(data.user.id) }
  }

  const inviteCode = String(body.inviteCode || '').trim()
  const { data: invite, error } = await admin
    .from('student_invites')
    .select('coach_id, student_id, status, expires_at')
    .eq('code', inviteCode)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error || !invite?.student_id || !invite?.coach_id) return null
  if (invite.expires_at && Date.parse(invite.expires_at) <= Date.now()) return null
  return { actorType, id: String(invite.student_id), coachId: String(invite.coach_id) }
}

async function getProviderToken() {
  const now = Math.floor(Date.now() / 1000)
  if (cachedProviderToken && now - cachedProviderTokenAt < 45 * 60) return cachedProviderToken
  const key = await importPKCS8(APNS_AUTH_KEY_P8, 'ES256')
  cachedProviderToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: APNS_KEY_ID })
    .setIssuedAt(now)
    .setIssuer(APNS_TEAM_ID)
    .sign(key)
  cachedProviderTokenAt = now
  return cachedProviderToken
}

async function updateDelivery(
  admin: ReturnType<typeof createClient>,
  messageId: string,
  status: 'sent' | 'failed' | 'no_devices',
  errorCode: string | null,
) {
  await admin.from('chat_push_delivery_log').update({
    status,
    delivered_at: status === 'sent' ? new Date().toISOString() : null,
    last_error_code: errorCode,
    updated_at: new Date().toISOString(),
  }).eq('message_id', messageId)
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
