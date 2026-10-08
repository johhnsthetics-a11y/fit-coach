import { spawnSync } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exerciseLibrary } from '../../src/exerciseCatalog.js'
import { buildExerciseMediaPlan, validatePlannedSourceFiles } from './freeExerciseDbImporter.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function parseArgs(values) {
  const options = { upload: false }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === '--upload') options.upload = true
    else if (value.startsWith('--')) options[value.slice(2)] = values[index += 1]
  }
  return options
}

async function findDatasetJson(datasetRoot) {
  const candidates = [
    path.join(datasetRoot, 'dist', 'exercises.json'),
    path.join(datasetRoot, 'exercises.json'),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next supported upstream layout.
    }
  }
  throw new Error(`exercises.json não encontrado em ${datasetRoot}`)
}

function formatManifest(manifest) {
  return `export const exerciseMediaManifest = Object.freeze(${JSON.stringify(manifest, null, 2)})\n\nexport default exerciseMediaManifest\n`
}

function runWranglerUpload({ bucket, datasetRoot, upload }) {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const sourceFile = path.join(datasetRoot, upload.sourcePath)
  const result = spawnSync(pnpm, [
    'dlx', 'wrangler@4', 'r2', 'object', 'put', `${bucket}/${upload.key}`,
    '--file', sourceFile,
    '--content-type', upload.contentType,
    '--remote',
  ], { cwd: projectRoot, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Falha ao enviar ${upload.key} para o R2`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.dataset) throw new Error('Informe --dataset <diretório do free-exercise-db>')
  if (options.upload && !options.bucket) throw new Error('Informe --bucket <nome> no modo de upload')

  const datasetRoot = path.resolve(options.dataset)
  const datasetJson = await findDatasetJson(datasetRoot)
  const datasetExercises = JSON.parse(await readFile(datasetJson, 'utf8'))
  const plan = buildExerciseMediaPlan({
    coachExercises: exerciseLibrary,
    datasetExercises,
    mediaBaseUrl: 'https://media.coachfitpro.com.br',
  })
  const missing = await validatePlannedSourceFiles(plan.uploads, datasetRoot)
  if (missing.length) throw new Error(`Imagens ausentes no dataset:\n${missing.join('\n')}`)

  const reportPath = path.resolve(options.report || path.join(projectRoot, 'artifacts', 'exercise-media-coverage.json'))
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    datasetJson: path.relative(datasetRoot, datasetJson).replaceAll('\\', '/'),
    totals: {
      catalog: exerciseLibrary.length,
      matched: plan.matched.length,
      unmatched: plan.unmatched.length,
      ambiguous: plan.ambiguous.length,
      uploads: plan.uploads.length,
    },
    matched: plan.matched,
    unmatched: plan.unmatched,
    ambiguous: plan.ambiguous,
  }, null, 2)}\n`)

  if (options.upload) {
    for (const upload of plan.uploads) runWranglerUpload({ bucket: options.bucket, datasetRoot, upload })
    const manifestPath = path.resolve(options.manifest || path.join(projectRoot, 'src', 'data', 'exerciseMediaManifest.js'))
    await writeFile(manifestPath, formatManifest(plan.manifest))
  }

  console.log(`Catálogo: ${exerciseLibrary.length}`)
  console.log(`Correspondências seguras: ${plan.matched.length}`)
  console.log(`Sem mídia: ${plan.unmatched.length}`)
  console.log(`Ambíguas: ${plan.ambiguous.length}`)
  console.log(`Objetos R2: ${plan.uploads.length}`)
  console.log(`Relatório: ${reportPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
