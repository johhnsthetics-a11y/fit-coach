import { createClient } from 'npm:@supabase/supabase-js@2.91.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: 'Serviço indisponível.' }, 503)

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const actor = await resolveActor(request, body, admin)
  if (!actor) return jsonResponse({ error: 'Sessão ou convite inválido.' }, 401)

  if (body.action === 'status') {
    const configured = Boolean(
      Deno.env.get('APNS_AUTH_KEY_P8')
      && Deno.env.get('APNS_KEY_ID')
      && Deno.env.get('APNS_TEAM_ID')
      && Deno.env.get('APNS_BUNDLE_ID')
      && ['sandbox', 'production'].includes(Deno.env.get('APNS_ENVIRONMENT') ?? ''),
    )
    const { error } = await admin.from('chat_push_devices').select('device_token', { head: true }).limit(1)
    return jsonResponse({ available: configured && !error })
  }

  const token = String(body.token || '').trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(token)) return jsonResponse({ error: 'Token APNs inválido.' }, 400)

  const identity = actor.actorType === 'coach'
    ? { actor_type: 'coach', coach_id: actor.id, student_id: null }
    : { actor_type: 'student', coach_id: null, student_id: actor.id }

  if (body.action === 'unregister') {
    let query = admin.from('chat_push_devices').delete().eq('device_token', token).eq('actor_type', actor.actorType)
    query = actor.actorType === 'coach' ? query.eq('coach_id', actor.id) : query.eq('student_id', actor.id)
    const { error } = await query
    if (error) return jsonResponse({ error: 'Não foi possível remover este dispositivo.' }, 500)
    return jsonResponse({ ok: true })
  }

  if (body.action !== 'register') return jsonResponse({ error: 'Ação inválida.' }, 400)

  const { error } = await admin.from('chat_push_devices').upsert({
    ...identity,
    device_token: token,
    platform: 'ios',
    active: true,
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'device_token' })
  if (error) return jsonResponse({ error: 'Não foi possível ativar os avisos neste dispositivo.' }, 500)
  return jsonResponse({ ok: true })
})

async function resolveActor(
  request: Request,
  body: Record<string, unknown>,
  admin: ReturnType<typeof createClient>,
) {
  const actorType = body.actorType === 'student' ? 'student' : body.actorType === 'coach' ? 'coach' : ''
  if (!actorType) return null

  if (actorType === 'coach') {
    const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
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
  const requestedStudentId = String(body.studentId || '')
  if (requestedStudentId && requestedStudentId !== String(invite.student_id)) return null
  return { actorType, id: String(invite.student_id), coachId: String(invite.coach_id) }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
