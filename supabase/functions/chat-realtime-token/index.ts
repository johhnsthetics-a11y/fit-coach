import { createClient } from 'npm:@supabase/supabase-js@2.91.0'
import { SignJWT } from 'npm:jose@6.1.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const JWT_SECRET = Deno.env.get('FITCOACH_REALTIME_JWT_SECRET') ?? ''
const TOKEN_TTL_SECONDS = 55 * 60
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JWT_SECRET) return jsonResponse({ error: 'Realtime indisponível.' }, 503)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const inviteCode = String(body.inviteCode || '').trim()

  let subject = ''
  let topic = ''
  let actor = ''
  if (inviteCode) {
    const access = await validateInvite(admin, inviteCode)
    if (!access) return jsonResponse({ error: 'Convite inválido ou expirado.' }, 403)
    subject = access.studentId
    topic = `chat-student:${access.studentId}`
    actor = 'student'
  } else {
    const user = await getAuthenticatedUser(request, admin)
    if (!user) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401)
    subject = user.id
    topic = `chat-coach:${user.id}`
    actor = 'coach'
  }

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + TOKEN_TTL_SECONDS
  const token = await new SignJWT({ role: 'authenticated', chat_actor: actor })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(subject)
    .setAudience('authenticated')
    .setIssuer('supabase')
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(JWT_SECRET))

  return jsonResponse({ ok: true, token, topic, expiresAt })
})

async function validateInvite(admin: ReturnType<typeof createClient>, inviteCode: string) {
  const { data: invite } = await admin
    .from('student_invites')
    .select('coach_id, student_id, status, expires_at')
    .eq('code', inviteCode)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (!invite || (invite.expires_at && Date.parse(invite.expires_at) <= Date.now())) return null
  return { coachId: String(invite.coach_id), studentId: String(invite.student_id) }
}

async function getAuthenticatedUser(request: Request, admin: ReturnType<typeof createClient>) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data?.user || null
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
