import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const PRODUCTION_ENDPOINTS = [
  { name: 'aplicativo', url: 'https://app.coachfitpro.com.br/', expectedText: 'Coach Fit Pro' },
  { name: 'login', url: 'https://app.coachfitpro.com.br/login?mode=signin', expectedText: 'Coach Fit Pro' },
  { name: 'privacidade', url: 'https://app.coachfitpro.com.br/politica-de-privacidade', expectedText: 'Coach Fit Pro' },
  { name: 'supabase-auth', url: 'https://zrlcisuuekudczkbapil.supabase.co/auth/v1/health', requiresAnonKey: true },
]

async function loadSupabaseAnonKey() {
  const configuredKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (configuredKey) return configuredKey

  const productionEnv = await readFile(new URL('../.env.production', import.meta.url), 'utf8').catch(() => '')
  const match = productionEnv.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)
  return String(match?.[1] || '').trim().replace(/^["']|["']$/g, '')
}

export async function checkEndpoint(endpoint, fetchImpl = globalThis.fetch, { supabaseAnonKey = '' } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), endpoint.timeoutMs || 15000)
  const startedAt = Date.now()

  try {
    if (endpoint.requiresAnonKey && !supabaseAnonKey) {
      throw new Error(`${endpoint.name}: chave pública do Supabase não configurada`)
    }
    const response = await fetchImpl(endpoint.url, {
      headers: {
        Accept: endpoint.expectedText ? 'text/html,*/*;q=0.8' : 'application/json,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'User-Agent': 'CoachFitPro-Production-Monitor/1.0',
        ...(endpoint.requiresAnonKey ? { apikey: supabaseAnonKey } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`${endpoint.name}: HTTP ${response.status}`)
    if (endpoint.expectedText) {
      const body = await response.text()
      if (!body.includes(endpoint.expectedText)) {
        throw new Error(`${endpoint.name}: conteúdo esperado não encontrado`)
      }
    }

    return {
      name: endpoint.name,
      status: response.status,
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${endpoint.name}: tempo limite excedido`)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function runProductionHealthCheck({
  endpoints = PRODUCTION_ENDPOINTS,
  fetchImpl = globalThis.fetch,
  supabaseAnonKey,
} = {}) {
  const resolvedAnonKey = supabaseAnonKey || (endpoints.some((endpoint) => endpoint.requiresAnonKey)
    ? await loadSupabaseAnonKey()
    : '')
  const results = await Promise.allSettled(
    endpoints.map((endpoint) => checkEndpoint(endpoint, fetchImpl, { supabaseAnonKey: resolvedAnonKey })),
  )
  const failures = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || String(result.reason))

  if (failures.length) throw new Error(`Falha na produção: ${failures.join('; ')}`)
  return results.map((result) => result.value)
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  runProductionHealthCheck()
    .then((results) => {
      process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), results })}\n`)
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = 1
    })
}
