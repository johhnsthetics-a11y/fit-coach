import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PRODUCTION_ENDPOINTS, checkEndpoint, runProductionHealthCheck } from './production-health.mjs'
import { exportSupabaseStorage } from './supabase-storage-backup.mjs'

test('health check valida status e identidade da aplicacao', async () => {
  const ok = await checkEndpoint(
    { name: 'app', url: 'https://example.test', expectedText: 'Coach Fit Pro' },
    async () => new Response('<title>Coach Fit Pro</title>', { status: 200 }),
  )

  assert.equal(ok.name, 'app')
  assert.equal(ok.status, 200)

  await assert.rejects(
    checkEndpoint(
      { name: 'app', url: 'https://example.test', expectedText: 'Coach Fit Pro' },
      async () => new Response('<title>Outra pagina</title>', { status: 200 }),
    ),
    /conteúdo esperado/i,
  )
})

test('health check agrega falhas sem esconder qual servico caiu', async () => {
  await assert.rejects(
    runProductionHealthCheck({
      endpoints: [
        { name: 'site', url: 'https://site.test' },
        { name: 'auth', url: 'https://auth.test' },
      ],
      fetchImpl: async (url) => new Response('', { status: url.includes('auth') ? 503 : 200 }),
    }),
    /auth.*503/i,
  )
})

test('health check autentica a leitura de saude do Supabase sem expor a chave', async () => {
  let requestHeaders
  await checkEndpoint(
    { name: 'supabase-auth', url: 'https://project.supabase.co/auth/v1/health', requiresAnonKey: true },
    async (_url, options) => {
      requestHeaders = options.headers
      return new Response('{"version":"test"}', { status: 200 })
    },
    { supabaseAnonKey: 'public-test-key' },
  )

  assert.equal(requestHeaders.apikey, 'public-test-key')
})

test('health check distingue bloqueio do monitor na borda de indisponibilidade da aplicacao', async () => {
  const result = await checkEndpoint(
    {
      name: 'dominio-oficial',
      url: 'https://app.coachfitpro.com.br/',
      acceptedStatuses: [200, 403],
    },
    async () => new Response('', { status: 403 }),
  )

  assert.equal(result.status, 403)
  assert.equal(result.degraded, true)
  assert.ok(PRODUCTION_ENDPOINTS.some((endpoint) => endpoint.expectedText && endpoint.url.includes('workers.dev')))
})

test('backup de Storage preserva caminhos e rejeita travessia de diretorio', async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'coachfit-storage-'))
  const files = new Map([
    ['checkins/aluno/foto.jpg', new Blob(['foto-segura'])],
  ])
  const storage = {
    listBuckets: async () => ({ data: [{ id: 'checkins', name: 'checkins', public: false }], error: null }),
    from: () => ({
      list: async (prefix) => ({
        data: prefix ? [{ id: 'object-id', name: 'foto.jpg', metadata: { size: 11 } }] : [{ id: null, name: 'aluno', metadata: null }],
        error: null,
      }),
      download: async (objectPath) => ({ data: files.get(`checkins/${objectPath}`), error: null }),
    }),
  }

  try {
    const manifest = await exportSupabaseStorage({ storage, outputDir })
    assert.equal(manifest.objects.length, 1)
    assert.equal(await readFile(path.join(outputDir, 'checkins', 'aluno', 'foto.jpg'), 'utf8'), 'foto-segura')
    await assert.rejects(
      exportSupabaseStorage({
        storage: {
          ...storage,
          from: () => ({
            list: async () => ({ data: [{ id: 'bad', name: '..', metadata: { size: 1 } }], error: null }),
            download: async () => ({ data: new Blob(['x']), error: null }),
          }),
        },
        outputDir,
      }),
      /caminho inválido/i,
    )
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

test('workflows monitoram producao e enviam somente backup criptografado ao R2 privado', async () => {
  const [healthWorkflow, backupWorkflow, guide] = await Promise.all([
    readFile(new URL('../.github/workflows/production-health.yml', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/encrypted-production-backup.yml', import.meta.url), 'utf8'),
    readFile(new URL('../docs/OPERACAO-PRODUCAO.md', import.meta.url), 'utf8'),
  ])

  assert.match(healthWorkflow, /schedule:/)
  assert.match(healthWorkflow, /node scripts\/production-health\.mjs/)
  assert.match(backupWorkflow, /PRODUCTION_BACKUPS_ENABLED/)
  assert.match(backupWorkflow, /supabase@2\.120\.0 db dump/)
  assert.match(backupWorkflow, /node scripts\/supabase-storage-backup\.mjs/)
  assert.match(backupWorkflow, /openssl enc -aes-256-cbc/)
  assert.match(backupWorkflow, /aws s3 cp/)
  assert.doesNotMatch(backupWorkflow, /upload-artifact/)
  assert.match(guide, /bucket privado/i)
  assert.match(guide, /plano gratuito/i)
})
