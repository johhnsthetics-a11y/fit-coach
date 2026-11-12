import { Buffer } from 'node:buffer'
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
} from 'npm:@apple/app-store-server-library@3.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const issuerId = Deno.env.get('APPLE_IAP_ISSUER_ID') ?? ''
const keyId = Deno.env.get('APPLE_IAP_KEY_ID') ?? ''
const privateKey = (Deno.env.get('APPLE_IAP_PRIVATE_KEY') ?? '').replaceAll('\\n', '\n').trim()
const bundleId = Deno.env.get('APPLE_BUNDLE_ID') || 'br.com.coachfitpro.ios'
const appAppleId = Number(Deno.env.get('APPLE_APP_ID') || '6827708756')
const productIds = new Set([
  'br.com.coachfitpro.ios.profissional.mensal',
  'br.com.coachfitpro.ios.profissional.semestral',
  'br.com.coachfitpro.ios.profissional.anual',
])
const entitlementTable = 'professional_apple_subscription_entitlements'
const activeCacheMs = 60_000
const rootsPromise = Promise.all([
  Deno.readFile(new URL('./AppleRootCA-G2.cer', import.meta.url)),
  Deno.readFile(new URL('./AppleRootCA-G3.cer', import.meta.url)),
]).then((certificates) => certificates.map((certificate) => Buffer.from(certificate)))

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Serviço de assinatura indisponível.' }, 503)

  const authorization = request.headers.get('authorization') || ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return jsonResponse({ error: 'Sessão profissional obrigatória.' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const user = authData?.user
  if (authError || !user?.id) return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401)

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) return jsonResponse({ error: 'Não foi possível validar a conta profissional.' }, 502)
  if (!isProfessionalRole(profile?.role)) return jsonResponse({ error: 'Esta verificação é exclusiva de contas profissionais.' }, 403)

  const body = await request.json().catch(() => ({}))
  const originalTransactionId = String(body?.originalTransactionId || '').trim()
  if (!/^[0-9]{1,32}$/.test(originalTransactionId)) {
    return jsonResponse({ error: 'Transação Apple inválida.' }, 400)
  }
  if (!issuerId || !keyId || !privateKey || !Number.isSafeInteger(appAppleId) || appAppleId <= 0) {
    return jsonResponse({ error: 'A validação Apple do servidor ainda não foi configurada.' }, 503)
  }

  const cached = await hasFreshActiveAppleEntitlement(admin, user.id)
  if (cached) return jsonResponse({ ok: true, active: true, cached: true })

  try {
    const lookup = await lookupAppleSubscription(originalTransactionId)
    if (!lookup) return jsonResponse({ ok: true, active: false, environment: null })

    const verifier = await verifierFor(lookup.environment)
    const verifiedRows = await verifyStatusRows(lookup.response, lookup.environment, verifier, user.id)
    let active = false
    const verifiedAt = new Date().toISOString()

    for (const row of verifiedRows) {
      const { error: saveError } = await admin
        .from(entitlementTable)
        .upsert({
          original_transaction_id: row.originalTransactionId,
          owner_professional_id: user.id,
          transaction_id: row.transactionId,
          product_id: row.productId,
          apple_environment: row.environment,
          status_code: row.status,
          expires_at: row.expiresAt,
          grace_expires_at: row.graceExpiresAt,
          revoked_at: row.revokedAt,
          last_verified_at: verifiedAt,
          updated_at: verifiedAt,
        }, { onConflict: 'original_transaction_id' })
      if (saveError) {
        if (/already linked to another account|vinculada a outra conta/i.test(saveError.message || '')) {
          return jsonResponse({ error: 'Esta assinatura Apple está vinculada a outra conta Coach Fit Pro.' }, 409)
        }
        console.error('Falha ao salvar entitlement Apple validado.', saveError.message)
        return jsonResponse({ error: 'Não foi possível registrar a confirmação da App Store.' }, 502)
      }
      active ||= row.active
    }

    return jsonResponse({
      ok: true,
      active,
      cached: false,
      environment: lookup.environment === Environment.PRODUCTION ? 'Production' : 'Sandbox',
      checkedAt: verifiedAt,
    })
  } catch (error) {
    console.error('Falha na verificação server-side da App Store.', error instanceof Error ? error.message : 'unknown')
    return jsonResponse({ error: 'A App Store não pôde confirmar a assinatura agora. Tente novamente em instantes.' }, 502)
  }
})

function isProfessionalRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase()
  return role.includes('nutri') || /trainer|treinador|coach|personal/.test(role)
}

async function hasFreshActiveAppleEntitlement(admin: ReturnType<typeof createClient<any>>, userId: string) {
  const cutoff = new Date(Date.now() - activeCacheMs).toISOString()
  const { data, error } = await admin
    .from(entitlementTable)
    .select('status_code, expires_at, grace_expires_at, revoked_at')
    .eq('owner_professional_id', userId)
    .in('status_code', [1, 4])
    .is('revoked_at', null)
    .gt('last_verified_at', cutoff)
  if (error || !Array.isArray(data)) return false
  const now = Date.now()
  return data.some((row) => {
    const expiry = Date.parse(row.expires_at || '')
    const graceExpiry = Date.parse(row.grace_expires_at || '')
    return (row.status_code === 1 && Number.isFinite(expiry) && expiry > now)
      || (row.status_code === 4 && Number.isFinite(graceExpiry) && graceExpiry > now)
  })
}

async function lookupAppleSubscription(originalId: string) {
  const environments = [Environment.PRODUCTION, Environment.SANDBOX]
  for (const environment of environments) {
    const client = new AppStoreServerAPIClient(privateKey, keyId, issuerId, bundleId, environment)
    try {
      const response = await client.getAllSubscriptionStatuses(originalId)
      if (response.bundleId !== bundleId) throw new Error('Bundle identifier mismatch in Apple response.')
      if (Number(response.appAppleId) !== appAppleId && environment === Environment.PRODUCTION) {
        throw new Error('App Store identifier mismatch in Apple response.')
      }
      if (response.environment !== environment) throw new Error('Environment mismatch in Apple response.')
      return { environment, response }
    } catch (error) {
      const httpStatus = Number((error as { httpStatusCode?: number })?.httpStatusCode)
      if (httpStatus === 404 && environment === Environment.PRODUCTION) continue
      if (httpStatus === 404 && environment === Environment.SANDBOX) return null
      throw error
    }
  }
  return null
}

async function verifierFor(environment: Environment) {
  const certificates = await rootsPromise
  const appId = environment === Environment.PRODUCTION ? appAppleId : undefined
  return new SignedDataVerifier(certificates, true, environment, bundleId, appId)
}

async function verifyStatusRows(response: unknown, environment: Environment, verifier: SignedDataVerifier, userId: string) {
  const now = Date.now()
  const rows = new Map<string, Record<string, unknown> & { active: boolean; signedDate: number }>()
  const responseData = (response as { data?: unknown })?.data
  const groups = Array.isArray(responseData) ? responseData : []

  for (const group of groups) {
    const transactions = Array.isArray((group as Record<string, unknown>)?.lastTransactions)
      ? (group as Record<string, unknown>).lastTransactions as Array<Record<string, unknown>>
      : []
    for (const item of transactions) {
      if (typeof item.signedTransactionInfo !== 'string') continue
      const status = Number(item.status)
      if (!Number.isInteger(status) || status < 1 || status > 5) continue

      const transaction = await verifier.verifyAndDecodeTransaction(item.signedTransactionInfo)
      const renewal = typeof item.signedRenewalInfo === 'string'
        ? await verifier.verifyAndDecodeRenewalInfo(item.signedRenewalInfo)
        : null
      if (String(transaction.appAccountToken || '').toLowerCase() !== userId.toLowerCase()) continue
      if (transaction.bundleId !== bundleId || transaction.environment !== environment) continue
      if (!productIds.has(String(transaction.productId || ''))) continue

      const originalTransactionId = String(transaction.originalTransactionId || '')
      const transactionId = String(transaction.transactionId || '')
      if (!/^[0-9]{1,32}$/.test(originalTransactionId) || !/^[0-9]{1,32}$/.test(transactionId)) continue
      if (renewal && renewal.originalTransactionId && String(renewal.originalTransactionId) !== originalTransactionId) continue
      if (renewal && renewal.productId && String(renewal.productId) !== String(transaction.productId)) continue

      const expiresAt = isoFromAppleMillis(transaction.expiresDate)
      const graceExpiresAt = isoFromAppleMillis(renewal?.gracePeriodExpiresDate)
      const revokedAt = isoFromAppleMillis(transaction.revocationDate)
      const expiresMs = expiresAt ? Date.parse(expiresAt) : Number.NaN
      const graceMs = graceExpiresAt ? Date.parse(graceExpiresAt) : Number.NaN
      const isActive = !revokedAt && (
        (status === 1 && Number.isFinite(expiresMs) && expiresMs > now)
        || (status === 4 && Number.isFinite(graceMs) && graceMs > now)
      )
      const signedDate = Number(transaction.signedDate || 0)
      const current = rows.get(originalTransactionId)
      if (current && current.signedDate > signedDate) continue

      rows.set(originalTransactionId, {
        originalTransactionId,
        transactionId,
        productId: String(transaction.productId),
        environment: environment === Environment.PRODUCTION ? 'Production' : 'Sandbox',
        status,
        expiresAt,
        graceExpiresAt,
        revokedAt,
        active: isActive,
        signedDate,
      })
    }
  }

  return [...rows.values()]
}

function isoFromAppleMillis(value: unknown) {
  const millis = Number(value)
  if (!Number.isFinite(millis) || millis <= 0) return null
  const date = new Date(millis)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
