import { createClient } from 'npm:@supabase/supabase-js@2.91.0'
import {
  buildTemporaryPassword,
  canRegenerateTemporaryPassword,
  normalizeCredentialEmail,
} from './credentialPolicy.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: 'Geração de acesso indisponível.' }, 503)

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const caller = authData?.user
  if (authError || !caller?.id) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401)

  const body = await request.json().catch(() => ({}))
  if (body?.action === 'generate') return generateCredentials(admin, caller, String(body?.studentId || ''))
  if (body?.action === 'complete-first-password') {
    return completeFirstPassword(admin, caller, String(body?.password || ''))
  }
  return jsonResponse({ error: 'Operação inválida.' }, 400)
})

async function generateCredentials(
  admin: ReturnType<typeof createClient>,
  caller: { id: string },
  studentId: string,
) {
  if (!uuidPattern.test(studentId)) return jsonResponse({ error: 'Aluno ou paciente inválido.' }, 400)

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id, coach_id, name, email, auth_user_id, must_change_password')
    .eq('coach_id', caller.id)
    .eq('id', studentId)
    .limit(1)
    .maybeSingle()
  if (studentError) return jsonResponse({ error: 'Não foi possível validar o cadastro.' }, 502)
  if (!student) return jsonResponse({ error: 'Aluno ou paciente não encontrado.' }, 404)

  let email = ''
  try {
    email = normalizeCredentialEmail(student.email)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'E-mail inválido.' }, 400)
  }

  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const temporaryPassword = buildTemporaryPassword(randomBytes)
  const generatedAt = new Date().toISOString()

  if (student.auth_user_id) {
    if (!canRegenerateTemporaryPassword(student)) {
      return jsonResponse({ error: 'Este acesso já foi ativado. Use a recuperação de senha no login.' }, 409)
    }

    const { data: linkedAuth } = await admin.auth.admin.getUserById(student.auth_user_id)
    const { error: resetError } = await admin.auth.admin.updateUserById(student.auth_user_id, {
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: { ...(linkedAuth?.user?.app_metadata ?? {}), account_type: 'student' },
    })
    if (resetError) return jsonResponse({ error: 'Não foi possível renovar os dados de acesso.' }, 502)

    const { error: markError } = await admin
      .from('students')
      .update({ credentials_generated_at: generatedAt, must_change_password: true })
      .eq('id', studentId)
      .eq('coach_id', caller.id)
      .eq('auth_user_id', student.auth_user_id)
    if (markError) return jsonResponse({ error: 'A senha foi renovada, mas o cadastro não pôde ser atualizado. Tente novamente.' }, 502)
    return jsonResponse({ email, temporaryPassword, mustChangePassword: true })
  }

  const inviteReady = await ensureActiveInvite(admin, studentId, caller.id)
  if (!inviteReady) return jsonResponse({ error: 'Não foi possível preparar o acesso do aluno ou paciente.' }, 502)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { account_type: 'student' },
    user_metadata: { name: String(student.name || '') },
  })
  if (createError || !created?.user?.id) {
    return jsonResponse({ error: 'Não foi possível gerar este acesso. Confirme o e-mail ou use a recuperação de senha.' }, 409)
  }

  const authUserId = created.user.id
  const { data: linked, error: linkError } = await admin
    .from('students')
    .update({
      auth_user_id: authUserId,
      must_change_password: true,
      credentials_generated_at: generatedAt,
    })
    .eq('id', studentId)
    .eq('coach_id', caller.id)
    .is('auth_user_id', null)
    .select('id')
    .maybeSingle()
  if (linkError || !linked) {
    await admin.auth.admin.deleteUser(authUserId)
    return jsonResponse({ error: 'Não foi possível concluir o vínculo de acesso. Tente novamente.' }, 502)
  }

  return jsonResponse({ email, temporaryPassword, mustChangePassword: true })
}

async function ensureActiveInvite(admin: ReturnType<typeof createClient>, studentId: string, coachId: string) {
  const { data: activeInvite, error: lookupError } = await admin
    .from('student_invites')
    .select('id')
    .eq('student_id', studentId)
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (lookupError) return false
  if (activeInvite) return true

  const code = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
  const { error } = await admin.from('student_invites').insert({
    student_id: studentId,
    coach_id: coachId,
    code,
    status: 'active',
  })
  return !error
}

async function completeFirstPassword(
  admin: ReturnType<typeof createClient>,
  caller: { id: string },
  password: string,
) {
  if (password.length < 8) return jsonResponse({ error: 'A nova senha deve ter pelo menos 8 caracteres.' }, 400)

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id')
    .eq('auth_user_id', caller.id)
    .eq('must_change_password', true)
    .limit(1)
    .maybeSingle()
  if (studentError) return jsonResponse({ error: 'Não foi possível validar o primeiro acesso.' }, 502)
  if (!student) return jsonResponse({ error: 'A troca inicial de senha não está pendente.' }, 409)

  const { error: passwordError } = await admin.auth.admin.updateUserById(caller.id, { password })
  if (passwordError) return jsonResponse({ error: 'Não foi possível atualizar a senha.' }, 502)

  const { data: updated, error: updateError } = await admin
    .from('students')
    .update({ must_change_password: false })
    .eq('id', student.id)
    .eq('auth_user_id', caller.id)
    .eq('must_change_password', true)
    .select('id')
    .maybeSingle()
  if (updateError || !updated) {
    return jsonResponse({ error: 'A senha foi atualizada. Entre novamente para concluir a ativação.' }, 502)
  }
  return jsonResponse({ mustChangePassword: false })
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
