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

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: storageRows, error: storageLookupError } = await userClient.rpc('coachfit_account_storage_references')
  if (storageLookupError) {
    return jsonResponse({ ok: false, error: 'Nao foi possivel preparar a remocao dos arquivos da conta.' }, 503)
  }

  const pathsByBucket = new Map<string, string[]>()
  for (const object of collectStorageObjects(storageRows)) {
    const paths = pathsByBucket.get(object.bucket) ?? []
    paths.push(object.path)
    pathsByBucket.set(object.bucket, paths)
  }

  for (const [bucket, paths] of pathsByBucket) {
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100))
      if (error) return jsonResponse({ ok: false, error: 'Nao foi possivel remover todos os arquivos da conta.' }, 502)
    }
  }

  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id)
  if (deletionError) return jsonResponse({ ok: false, error: 'Nao foi possivel concluir a exclusao da conta.' }, 502)

  return jsonResponse({ ok: true }, 200)
})

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
