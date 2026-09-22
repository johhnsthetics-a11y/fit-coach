import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const AVATAR_BUCKET = 'profile-avatars'
const allowedMimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])
const maxFileSize = 3 * 1024 * 1024

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: 'Foto de perfil indisponivel.' }, 503)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('multipart/form-data')) return uploadStudentAvatar(request, admin)

  const body = await request.json().catch(() => ({}))
  if (body?.action === 'student-read') return readStudentAvatar(body, admin)
  if (body?.action === 'coach-read') return readCoachAvatars(request, admin)
  return jsonResponse({ error: 'Operacao invalida.' }, 400)
})

async function validateInvite(admin: ReturnType<typeof createClient>, inviteCode: string) {
  const { data: invite, error: inviteError } = await admin
    .from('student_invites')
    .select('student_id, coach_id, status, expires_at')
    .eq('code', inviteCode)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (inviteError || !invite || (invite.expires_at && Date.parse(invite.expires_at) <= Date.now())) return null

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id, coach_id, avatar_path')
    .eq('id', invite.student_id)
    .limit(1)
    .maybeSingle()
  if (studentError || !student || student.coach_id !== invite.coach_id) return null
  return { invite, student }
}

async function uploadStudentAvatar(request: Request, admin: ReturnType<typeof createClient>) {
  const form = await request.formData().catch(() => null)
  const inviteCode = String(form?.get('inviteCode') || '').trim()
  const file = form?.get('file')
  if (!inviteCode || !(file instanceof File)) return jsonResponse({ error: 'Convite ou imagem invalida.' }, 400)

  const extension = allowedMimeTypes.get(file.type)
  if (!extension) return jsonResponse({ error: 'Use uma imagem JPG, PNG ou WebP.' }, 415)
  if (file.size <= 0 || file.size > maxFileSize) return jsonResponse({ error: 'A foto precisa ter ate 3 MB.' }, 413)

  const access = await validateInvite(admin, inviteCode)
  if (!access) return jsonResponse({ error: 'Convite invalido ou expirado.' }, 403)
  const { invite, student } = access
  const avatarPath = `${student.id}/avatar-${Date.now()}-${crypto.randomUUID()}.${extension}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, bytes, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (uploadError) return jsonResponse({ error: 'Nao foi possivel enviar a foto.' }, 502)

  const { data: updated, error: updateError } = await admin
    .from('students')
    .update({ avatar_path: avatarPath })
    .eq('id', student.id)
    .eq('coach_id', invite.coach_id)
    .select('id')
    .maybeSingle()
  if (updateError || !updated) {
    await admin.storage.from(AVATAR_BUCKET).remove([avatarPath])
    return jsonResponse({ error: 'Nao foi possivel atualizar o perfil.' }, 502)
  }

  if (student.avatar_path && student.avatar_path !== avatarPath) {
    await admin.storage.from(AVATAR_BUCKET).remove([student.avatar_path])
  }
  return jsonResponse({ ok: true, avatarPath, avatarUrl: await createSignedAvatarUrl(admin, avatarPath) })
}

async function readStudentAvatar(body: Record<string, unknown>, admin: ReturnType<typeof createClient>) {
  const access = await validateInvite(admin, String(body?.inviteCode || '').trim())
  if (!access) return jsonResponse({ error: 'Convite invalido ou expirado.' }, 403)
  const avatarPath = String(access.student.avatar_path || '')
  return jsonResponse({ avatarPath, avatarUrl: await createSignedAvatarUrl(admin, avatarPath) })
}

async function readCoachAvatars(request: Request, admin: ReturnType<typeof createClient>) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData?.user?.id) return jsonResponse({ error: 'Sessao invalida ou expirada.' }, 401)

  const { data: students, error } = await admin
    .from('students')
    .select('id, avatar_path')
    .eq('coach_id', authData.user.id)
    .not('avatar_path', 'is', null)
  if (error) return jsonResponse({ error: 'Nao foi possivel carregar as fotos.' }, 502)

  const avatars = await Promise.all((students ?? []).map(async (student) => ({
    studentId: student.id,
    avatarPath: student.avatar_path,
    avatarUrl: await createSignedAvatarUrl(admin, student.avatar_path),
  })))
  return jsonResponse({ avatars })
}

async function createSignedAvatarUrl(admin: ReturnType<typeof createClient>, path: string) {
  if (!path) return ''
  const { data, error } = await admin.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return ''
  return `${data.signedUrl}${data.signedUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

