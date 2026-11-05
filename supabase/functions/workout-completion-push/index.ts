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
  const workoutLogId = String(body.workoutLogId || '').trim()
  const inviteCode = String(body.inviteCode || '').trim()
  if (!UUID_PATTERN.test(workoutLogId) || inviteCode.length < 6 || inviteCode.length > 96) {
    return jsonResponse({ error: 'Evento de treino inválido.' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: invite, error: inviteError } = await admin
    .from('student_invites')
    .select('coach_id, student_id, status, expires_at')
    .eq('code', inviteCode)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (inviteError || !invite?.coach_id || !invite?.student_id) {
    return jsonResponse({ error: 'Convite inválido ou expirado.' }, 401)
  }

  const { data: workoutLog, error: workoutLogError } = await admin
    .from('workout_logs')
    .select('id, coach_id, student_id, title, notes')
    .eq('id', workoutLogId)
    .maybeSingle()
  if (workoutLogError || !workoutLog) return jsonResponse({ error: 'Treino não encontrado.' }, 404)
  if (String(workoutLog.coach_id) !== String(invite.coach_id) || String(workoutLog.student_id) !== String(invite.student_id)) {
    return jsonResponse({ error: 'Este treino não pertence ao convite informado.' }, 403)
  }
  const notes = String(workoutLog.notes || '')
  if (!notes.includes('[coachfitpro-completion:') && !notes.includes('[coachfitpro-ended-early:')) {
    return jsonResponse({ error: 'O registro não representa um encerramento de treino do aluno.' }, 403)
  }

  const claim = await admin.rpc('claim_workout_completion_push_delivery', {
    p_workout_log_id: workoutLogId,
    p_coach_id: String(invite.coach_id),
  })
  if (claim.error) return jsonResponse({ error: 'Não foi possível preparar o aviso.' }, 500)
  if (claim.data !== true) return jsonResponse({ ok: true, duplicate: true })

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id, name, notify_coach_on_workout_finish')
    .eq('id', invite.student_id)
    .eq('coach_id', invite.coach_id)
    .maybeSingle()
  if (studentError || !student) {
    await updateDelivery(admin, workoutLogId, 'failed', 'student_lookup_failed')
    return jsonResponse({ error: 'Não foi possível confirmar as preferências do aluno.' }, 500)
  }
  if (student.notify_coach_on_workout_finish === false) {
    await updateDelivery(admin, workoutLogId, 'disabled', 'disabled_by_coach')
    return jsonResponse({ ok: true, suppressed: true })
  }

  const { data: devices, error: devicesError } = await admin
    .from('chat_push_devices')
    .select('device_token')
    .eq('actor_type', 'coach')
    .eq('coach_id', String(invite.coach_id))
    .eq('active', true)
  if (devicesError) {
    await updateDelivery(admin, workoutLogId, 'failed', 'device_lookup_failed')
    return jsonResponse({ error: 'Não foi possível localizar os dispositivos inscritos.' }, 500)
  }
  if (!devices?.length) {
    await updateDelivery(admin, workoutLogId, 'no_devices', null)
    return jsonResponse({ ok: true, delivered: 0 })
  }

  const providerToken = await getProviderToken()
  const host = APNS_ENVIRONMENT === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com'
  const studentId = String(invite.student_id)
  const payload = {
    aps: {
      alert: {
        title: 'Treino encerrado',
        body: 'Um aluno encerrou uma sessão de treino.',
      },
      sound: 'default',
      'thread-id': `coachfit-workout-${studentId}`,
    },
    event: 'student_workout_finished',
    recipientRole: 'coach',
    studentId,
    workoutLogId,
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
          'apns-collapse-id': `workout-${workoutLogId}`,
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
    await updateDelivery(admin, workoutLogId, 'sent', failures ? 'partial_failure' : null)
    return jsonResponse({ ok: true, delivered: accepted, failed: failures })
  }
  await updateDelivery(admin, workoutLogId, 'failed', 'apns_delivery_failed')
  return jsonResponse({ error: 'A Apple não aceitou o aviso para este dispositivo.' }, 502)
})

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
  workoutLogId: string,
  status: 'sent' | 'failed' | 'no_devices' | 'disabled',
  errorCode: string | null,
) {
  await admin.from('workout_completion_push_delivery_log').update({
    status,
    delivered_at: status === 'sent' ? new Date().toISOString() : null,
    last_error_code: errorCode,
    updated_at: new Date().toISOString(),
  }).eq('workout_log_id', workoutLogId)
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
