import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { collectStorageObjects, normalizeEmail } from './accountDeletionModel.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const MASTER_ADMIN_EMAIL = normalizeEmail(Deno.env.get('MASTER_ADMIN_EMAIL') ?? 'sac@coachfitpro.com.br')

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true }, 200)
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: 'Exclusao de conta indisponivel. Contate o suporte.' }, 503)
  }

  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) return jsonResponse({ ok: false, error: 'Sessao invalida ou expirada.' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const user = authData?.user
  if (authError || !user?.id || !user.email) {
    return jsonResponse({ ok: false, error: 'Sessao invalida ou expirada.' }, 401)
  }

  const body = await request.json().catch(() => ({}))
  const accountEmail = normalizeEmail(user.email)
  const requestedEmail = normalizeEmail(body?.email)
  const confirmation = normalizeEmail(body?.confirmation)
  if (!requestedEmail || requestedEmail !== accountEmail || confirmation !== accountEmail) {
    return jsonResponse({ ok: false, error: 'A confirmacao nao corresponde a conta autenticada.' }, 400)
  }

  const { data: adminRows, error: adminLookupError } = await admin
    .from('admin_users')
    .select('id')
    .eq('email', accountEmail)
    .eq('active', true)
    .limit(1)
  if (adminLookupError) {
    return jsonResponse({ ok: false, error: 'Nao foi possivel validar a protecao administrativa.' }, 503)
  }
  if (accountEmail === MASTER_ADMIN_EMAIL || adminRows?.length) {
    return jsonResponse({ ok: false, error: 'A conta master nao pode ser excluida por esta tela.' }, 403)
  }

  const { data: studentRows, error: studentLookupError } = await admin
    .from('students')
    .select('id, coach_id, email, auth_user_id')
    .eq('auth_user_id', user.id)
    .limit(1)
  if (studentLookupError) {
    return jsonResponse({ ok: false, error: 'Nao foi possivel identificar os dados vinculados a conta.' }, 503)
  }
  const studentAccount = studentRows?.[0] ?? null

  let linkedStudentAuthIds: string[] = []
  if (!studentAccount) {
    const { data: linkedStudents, error: linkedStudentsError } = await admin
      .from('students')
      .select('auth_user_id')
      .eq('coach_id', user.id)
      .not('auth_user_id', 'is', null)
    if (linkedStudentsError) {
      return jsonResponse({ ok: false, error: 'Nao foi possivel preparar a exclusao dos acessos vinculados.' }, 503)
    }
    linkedStudentAuthIds = [...new Set(
      (linkedStudents ?? [])
        .map((row) => String(row.auth_user_id ?? '').trim())
        .filter((id) => id && id !== user.id),
    )]
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: storageRows, error: storageLookupError } = await userClient.rpc('coachfit_account_storage_references')
  if (storageLookupError) {
    return jsonResponse({ ok: false, error: 'Nao foi possivel preparar a remocao dos arquivos da conta.' }, 503)
  }

  const storageRemovalError = await removeStorageObjects(admin, storageRows)
  if (storageRemovalError) return jsonResponse({ ok: false, error: storageRemovalError }, 502)

  if (studentAccount) {
    const { error: protocolDeletionError } = await admin
      .from('coach_protocol_tasks')
      .delete()
      .eq('student_id', studentAccount.id)
    if (protocolDeletionError) {
      return jsonResponse({ ok: false, error: 'Nao foi possivel remover as organizacoes vinculadas a conta.' }, 502)
    }

    const { error: grantDeletionError } = await admin
      .from('student_free_access_grants')
      .delete()
      .eq('email', accountEmail)
    if (grantDeletionError) {
      return jsonResponse({ ok: false, error: 'Nao foi possivel remover a liberacao vinculada a conta.' }, 502)
    }

    const { error: studentDeletionError } = await admin
      .from('students')
      .delete()
      .eq('id', studentAccount.id)
      .eq('auth_user_id', user.id)
    if (studentDeletionError) {
      return jsonResponse({ ok: false, error: 'Nao foi possivel remover os dados do aluno ou paciente.' }, 502)
    }
  } else {
    for (const studentAuthId of linkedStudentAuthIds) {
      const { error: linkedAuthDeletionError } = await admin.auth.admin.deleteUser(studentAuthId)
      if (linkedAuthDeletionError) {
        return jsonResponse({ ok: false, error: 'Nao foi possivel remover todos os acessos de alunos vinculados.' }, 502)
      }
    }
  }

  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id)
  if (deletionError) return jsonResponse({ ok: false, error: 'Nao foi possivel concluir a exclusao da conta.' }, 502)

  return jsonResponse({ ok: true, accountType: studentAccount ? 'student' : 'professional' }, 200)
})

async function removeStorageObjects(admin: ReturnType<typeof createClient>, rows: unknown) {
  const pathsByBucket = new Map<string, string[]>()
  for (const object of collectStorageObjects(Array.isArray(rows) ? rows : [])) {
    const paths = pathsByBucket.get(object.bucket) ?? []
    paths.push(object.path)
    pathsByBucket.set(object.bucket, paths)
  }

  for (const [bucket, paths] of pathsByBucket) {
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100))
      if (error) return 'Nao foi possivel remover todos os arquivos da conta.'
    }
  }

  return ''
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
