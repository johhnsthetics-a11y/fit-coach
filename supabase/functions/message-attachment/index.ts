import { createClient } from 'npm:@supabase/supabase-js@2.91.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BUCKET = 'message-attachments'
const MAX_FILE_BYTES = 12 * 1024 * 1024
const SIGNED_URL_SECONDS = 15 * 60
const allowedMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav',
  'application/pdf', 'text/plain',
])
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: 'Serviço de anexos indisponível.' }, 503)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    return uploadAttachment(request, admin, form)
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (body.action !== 'sign') return jsonResponse({ error: 'Ação inválida.' }, 400)
  return signAttachment(request, admin, body)
})

async function uploadAttachment(request: Request, admin: ReturnType<typeof createClient>, form: FormData) {
  const file = form.get('file')
  const inviteCode = String(form.get('inviteCode') || '').trim()
  const requestedStudentId = String(form.get('studentId') || '').trim()
  const messageId = String(form.get('messageId') || '').trim()
  if (!(file instanceof File) || !isUuid(messageId)) return jsonResponse({ error: 'Anexo inválido.' }, 400)

  const mimeType = normalizeMimeType(file.type)
  if (!allowedMimeTypes.has(mimeType)) return jsonResponse({ error: 'Tipo de arquivo não permitido.' }, 415)
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return jsonResponse({ error: 'O anexo precisa ter até 12 MB.' }, 413)

  const access = await resolveConversationAccess(request, admin, inviteCode, requestedStudentId)
  if (!access) return jsonResponse({ error: 'Conversa não autorizada.' }, 403)

  const extension = safeExtension(file.name, mimeType)
  const path = `messages/${access.coachId}/${access.studentId}/${messageId}-${crypto.randomUUID()}.${extension}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return jsonResponse({ error: 'Não foi possível enviar o anexo.' }, 502)
  return jsonResponse({ ok: true, path })
}

async function signAttachment(request: Request, admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const inviteCode = String(body.inviteCode || '').trim()
  const messageId = String(body.messageId || '').trim()
  const attachmentPath = normalizePath(String(body.attachmentPath || ''))
  if (!messageId || !attachmentPath) return jsonResponse({ error: 'Anexo inválido.' }, 400)

  const { data: message, error } = await admin
    .from('messages')
    .select('id, coach_id, student_id, attachment_url')
    .eq('id', messageId)
    .limit(1)
    .maybeSingle()
  if (error || !message) return jsonResponse({ error: 'Anexo não encontrado.' }, 404)
  if (normalizeStoredPath(String(message.attachment_url || '')) !== attachmentPath) {
    return jsonResponse({ error: 'Anexo não encontrado.' }, 404)
  }

  const access = await resolveConversationAccess(request, admin, inviteCode, String(message.student_id))
  if (!access || access.coachId !== String(message.coach_id) || access.studentId !== String(message.student_id)) {
    return jsonResponse({ error: 'Conversa não autorizada.' }, 403)
  }

  const { data, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(attachmentPath, SIGNED_URL_SECONDS)
  if (signedError || !data?.signedUrl) return jsonResponse({ error: 'Não foi possível abrir o anexo.' }, 502)
  return jsonResponse({ ok: true, path: attachmentPath, signedUrl: data.signedUrl, expiresIn: SIGNED_URL_SECONDS })
}

async function resolveConversationAccess(
  request: Request,
  admin: ReturnType<typeof createClient>,
  inviteCode: string,
  requestedStudentId: string,
) {
  if (inviteCode) return validateInvite(admin, inviteCode, requestedStudentId)

  const user = await getAuthenticatedUser(request, admin)
  if (!user || !requestedStudentId) return null
  const { data: student } = await admin
    .from('students')
    .select('id, coach_id')
    .eq('id', requestedStudentId)
    .eq('coach_id', user.id)
    .limit(1)
    .maybeSingle()
  return student ? { coachId: String(student.coach_id), studentId: String(student.id) } : null
}

async function validateInvite(admin: ReturnType<typeof createClient>, inviteCode: string, requestedStudentId = '') {
  const { data: invite } = await admin
    .from('student_invites')
    .select('coach_id, student_id, status, expires_at')
    .eq('code', inviteCode)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (!invite || (invite.expires_at && Date.parse(invite.expires_at) <= Date.now())) return null
  if (requestedStudentId && String(invite.student_id) !== requestedStudentId) return null
  return { coachId: String(invite.coach_id), studentId: String(invite.student_id) }
}

async function getAuthenticatedUser(request: Request, admin: ReturnType<typeof createClient>) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data?.user || null
}

function normalizeMimeType(value: string) {
  return String(value || '').split(';')[0].trim().toLowerCase()
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizePath(value: string) {
  const path = String(value || '').replace(/^\/+/, '')
  return path && !path.includes('..') ? path : ''
}

function normalizeStoredPath(value: string) {
  const normalized = String(value || '')
  const markers = [
    `/storage/v1/object/public/${BUCKET}/`,
    `/storage/v1/object/sign/${BUCKET}/`,
  ]
  const marker = markers.find((candidate) => normalized.includes(candidate))
  if (!marker) return normalizePath(normalized)
  return normalizePath(decodeURIComponent(normalized.split(marker)[1].split('?')[0]))
}

function safeExtension(name: string, mimeType: string) {
  const fromName = String(name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName && fromName.length <= 6) return fromName
  const defaults: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'application/pdf': 'pdf', 'text/plain': 'txt',
  }
  return defaults[mimeType] || 'bin'
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
