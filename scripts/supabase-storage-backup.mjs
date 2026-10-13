import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

function safeRelativePath(value) {
  const segments = String(value || '').split('/').filter(Boolean)
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..' || segment.includes('\\'))) {
    throw new Error(`Caminho inválido no Storage: ${value}`)
  }
  return segments.join('/')
}

async function listBucketObjects(bucket, bucketId) {
  const objects = []
  const pendingPrefixes = ['']
  const visitedPrefixes = new Set()

  while (pendingPrefixes.length) {
    const prefix = pendingPrefixes.shift()
    if (visitedPrefixes.has(prefix)) continue
    visitedPrefixes.add(prefix)

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await bucket.list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw new Error(`Falha ao listar ${bucketId}/${prefix}: ${error.message}`)

      const rows = Array.isArray(data) ? data : []
      for (const row of rows) {
        const rowName = safeRelativePath(row?.name)
        const objectPath = prefix ? `${prefix}/${rowName}` : rowName
        if (row?.id || row?.metadata) objects.push(objectPath)
        else pendingPrefixes.push(objectPath)
      }
      if (rows.length < PAGE_SIZE) break
    }
  }

  return objects
}

export async function exportSupabaseStorage({ storage, outputDir, maxObjects = 100000 }) {
  const { data: buckets, error: bucketsError } = await storage.listBuckets()
  if (bucketsError) throw new Error(`Falha ao listar buckets: ${bucketsError.message}`)

  const manifest = {
    exportedAt: new Date().toISOString(),
    buckets: [],
    objects: [],
  }

  for (const bucketInfo of buckets || []) {
    const bucketId = safeRelativePath(bucketInfo?.id || bucketInfo?.name)
    const bucket = storage.from(bucketId)
    const objectPaths = await listBucketObjects(bucket, bucketId)
    manifest.buckets.push({ id: bucketId, public: bucketInfo?.public === true })

    for (const objectPath of objectPaths) {
      if (manifest.objects.length >= maxObjects) {
        throw new Error(`Backup interrompido: limite seguro de ${maxObjects} objetos excedido.`)
      }

      const safeObjectPath = safeRelativePath(objectPath)
      const destination = path.resolve(outputDir, bucketId, ...safeObjectPath.split('/'))
      const bucketRoot = `${path.resolve(outputDir, bucketId)}${path.sep}`
      if (!destination.startsWith(bucketRoot)) throw new Error(`Caminho inválido no Storage: ${objectPath}`)

      const { data, error } = await bucket.download(safeObjectPath)
      if (error || !data) throw new Error(`Falha ao baixar ${bucketId}/${safeObjectPath}: ${error?.message || 'arquivo vazio'}`)
      await mkdir(path.dirname(destination), { recursive: true })
      await writeFile(destination, Buffer.from(await data.arrayBuffer()))
      manifest.objects.push({ bucket: bucketId, path: safeObjectPath, bytes: data.size })
    }
  }

  await mkdir(outputDir, { recursive: true })
  await writeFile(path.join(outputDir, 'storage-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}

async function main() {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const outputDir = path.resolve(process.argv[2] || 'backup/storage')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para o backup de Storage.')
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const manifest = await exportSupabaseStorage({ storage: client.storage, outputDir })
  process.stdout.write(`Storage exportado: ${manifest.objects.length} objetos em ${manifest.buckets.length} buckets.\n`)
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
