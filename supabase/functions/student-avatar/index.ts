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
type AdminClient = ReturnType<typeof createClient<any>>

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: 'Foto de perfil indisponivel.' }, 503)

  const admin = createClient<any>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('multipart/form-data')) return uploadAvatar(request, admin)

  const body = await request.json().catch(() => ({}))
  if (body?.action === 'student-read') return readStudentAvatar(request, body, admin)
  if (body?.action === 'coach-read') return readCoachAvatars(request, admin)
  return jsonResponse({ error: 'Operacao invalida.' }, 400)
})

async function validateInvite(admin: AdminClient, inviteCode: string) {
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
    .select('id, coach_id, avatar_path, auth_user_id')
    .eq('id', invite.student_id)
    .limit(1)
    .maybeSingle()
  if (studentError || !student || student.coach_id !== invite.coach_id) return null
  return { invite, student }
}

async function uploadAvatar(request: Request, admin: AdminClient) {
  const form = await request.formData().catch(() => null)
  if (form?.get('action') === 'professional-upload') return uploadProfessionalAvatar(request, form, admin)
  return uploadStudentAvatar(form, admin)
}

async function uploadStudentAvatar(form: FormData | null, admin: AdminClient) {
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

async function uploadProfessionalAvatar(request: Request, form: FormData, admin: AdminClient) {
  const user = await getAuthenticatedUser(request, admin)
  if (!user) return jsonResponse({ error: 'Sessao invalida ou expirada.' }, 401)

  const file = form.get('file')
  if (!(file instanceof File)) return jsonResponse({ error: 'Imagem invalida.' }, 400)
  const extension = allowedMimeTypes.get(file.type)
  if (!extension) return jsonResponse({ error: 'Use uma imagem JPG, PNG ou WebP.' }, 415)
  if (file.size <= 0 || file.size > maxFileSize) return jsonResponse({ error: 'A foto precisa ter ate 3 MB.' }, 413)

  const { data: currentSettings, error: settingsError } = await admin
    .from('coach_settings')
    .select('profile_avatar_path')
    .eq('coach_id', user.id)
    .limit(1)
    .maybeSingle()
  if (settingsError) return jsonResponse({ error: 'Nao foi possivel carregar o perfil.' }, 502)

  const avatarPath = `professionals/${user.id}/avatar-${Date.now()}-${crypto.randomUUID()}.${extension}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, bytes, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (uploadError) return jsonResponse({ error: 'Nao foi possivel enviar a foto.' }, 502)

  const { error: updateError } = await admin
    .from('coach_settings')
    .upsert({ coach_id: user.id, profile_avatar_path: avatarPath, updated_at: new Date().toISOString() }, { onConflict: 'coach_id' })
  if (updateError) {
    await admin.storage.from(AVATAR_BUCKET).remove([avatarPath])
    return jsonResponse({ error: 'Nao foi possivel atualizar o perfil.' }, 502)
  }

  const previousPath = String(currentSettings?.profile_avatar_path || '')
  if (previousPath && previousPath !== avatarPath) await admin.storage.from(AVATAR_BUCKET).remove([previousPath])
  return jsonResponse({ ok: true, avatarPath, avatarUrl: await createSignedAvatarUrl(admin, avatarPath) })
}

async function readStudentAvatar(request: Request, body: Record<string, unknown>, admin: AdminClient) {
  const access = await validateInvite(admin, String(body?.inviteCode || '').trim())
  if (!access) return jsonResponse({ error: 'Convite invalido ou expirado.' }, 403)
  const requester = await getAuthenticatedUser(request, admin)
  const authenticatedStudent = Boolean(requester?.id && access.student.auth_user_id === requester.id)
  const avatarPath = String(access.student.avatar_path || '')
  const { data: settings } = await admin
    .from('coach_settings')
    .select('profile_avatar_path')
    .eq('coach_id', access.invite.coach_id)
    .limit(1)
    .maybeSingle()
  const professionalAvatarPath = String(settings?.profile_avatar_path || '')
  let collaboratorAvatars: Array<Record<string, unknown>> = []
  const { data: delegations, error: delegationError } = authenticatedStudent ? await admin
    .from('professional_patient_delegations')
    .select('id, area, member_professional_id, team_id')
    .eq('student_id', access.student.id)
    .eq('owner_professional_id', access.invite.coach_id)
    .eq('status', 'active')
    .eq('consent_status', 'accepted') : { data: [], error: null }
  if (authenticatedStudent && !delegationError && delegations?.length) {
    const memberIds = [...new Set(delegations.map((item) => String(item.member_professional_id || '')).filter(Boolean))]
    const teamIds = [...new Set(delegations.map((item) => String(item.team_id || '')).filter(Boolean))]
    const [profilesResult, teamsResult, avatarsResult, membershipsResult] = await Promise.all([
      admin.from('users').select('id, name, role').in('id', memberIds),
      admin.from('professional_teams').select('id, name, owner_professional_id').in('id', teamIds),
      admin.from('coach_settings').select('coach_id, profile_avatar_path').in('coach_id', memberIds),
      admin.from('professional_team_members').select('team_id, member_professional_id, professional_role, status').in('team_id', teamIds).in('member_professional_id', memberIds),
    ])
    const profiles = new Map((profilesResult.data || []).map((row) => [String(row.id), row]))
    const teams = new Map((teamsResult.data || []).map((row) => [String(row.id), row]))
    const avatars = new Map((avatarsResult.data || []).map((row) => [String(row.coach_id), String(row.profile_avatar_path || '')]))
    const memberships = new Map((membershipsResult.data || []).map((row) => [`${row.team_id}:${row.member_professional_id}`, row]))
    collaboratorAvatars = (await Promise.all(delegations.map(async (delegation): Promise<Record<string, unknown> | null> => {
      const profile = profiles.get(String(delegation.member_professional_id))
      const team = teams.get(String(delegation.team_id))
      const member = memberships.get(`${delegation.team_id}:${delegation.member_professional_id}`)
      const expectedRole = delegation.area === 'nutrition' ? 'nutritionist' : delegation.area === 'workout' ? 'trainer' : ''
      const rawRole = String(profile?.role || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
      const profileMatchesArea = expectedRole === 'nutritionist'
        ? rawRole.includes('nutri')
        : expectedRole === 'trainer' && ['trainer', 'coach', 'personal trainer', 'personal', 'treinador', 'coach principal'].includes(rawRole)
      if (!expectedRole || !profileMatchesArea || member?.status !== 'active' || member?.professional_role !== expectedRole || team?.owner_professional_id !== access.invite.coach_id) return null
      const avatarPath = avatars.get(String(delegation.member_professional_id)) || ''
      return {
        delegationId: delegation.id,
        area: delegation.area,
        professionalId: delegation.member_professional_id,
        professionalName: profile?.name || 'Profissional colaborador',
        professionalRole: profile?.role || '',
        teamName: teams.get(String(delegation.team_id))?.name || '',
        professionalAvatarUrl: await createSignedAvatarUrl(admin, avatarPath, 300),
      }
    }))).filter((avatar): avatar is Record<string, unknown> => avatar !== null)
  }
  return jsonResponse({
    avatarPath,
    avatarUrl: await createSignedAvatarUrl(admin, avatarPath),
    professionalAvatarPath,
    professionalAvatarUrl: await createSignedAvatarUrl(admin, professionalAvatarPath),
    collaboratorAvatars,
  })
}

async function readCoachAvatars(request: Request, admin: AdminClient) {
  const user = await getAuthenticatedUser(request, admin)
  if (!user) return jsonResponse({ error: 'Sessao invalida ou expirada.' }, 401)

  const { data: students, error } = await admin
    .from('students')
    .select('id, avatar_path')
    .eq('coach_id', user.id)
    .not('avatar_path', 'is', null)
  if (error) return jsonResponse({ error: 'Nao foi possivel carregar as fotos.' }, 502)

  const { data: settings } = await admin
    .from('coach_settings')
    .select('profile_avatar_path')
    .eq('coach_id', user.id)
    .limit(1)
    .maybeSingle()
  const professionalAvatarPath = String(settings?.profile_avatar_path || '')

  const avatars = await Promise.all((students ?? []).map(async (student) => ({
    studentId: student.id,
    avatarPath: student.avatar_path,
    avatarUrl: await createSignedAvatarUrl(admin, student.avatar_path),
  })))
  return jsonResponse({
    avatars,
    professionalAvatarPath,
    professionalAvatarUrl: await createSignedAvatarUrl(admin, professionalAvatarPath),
  })
}

async function getAuthenticatedUser(request: Request, admin: AdminClient) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data?.user ?? null
}

async function createSignedAvatarUrl(admin: AdminClient, path: string, expiresInSeconds = 3600) {
  if (!path) return ''
  const { data, error } = await admin.storage.from(AVATAR_BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error || !data?.signedUrl) return ''
  return `${data.signedUrl}${data.signedUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

