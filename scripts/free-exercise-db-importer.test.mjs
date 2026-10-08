import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  buildWranglerUploadCommand,
  buildExerciseMediaPlan,
  parseExerciseMediaArgs,
  resolveUploadSourceFile,
  validatePlannedSourceFiles,
} from './exercise-media/freeExerciseDbImporter.mjs'

const fixtureRoot = fileURLToPath(new URL('./fixtures/free-exercise-db/', import.meta.url))
const datasetExercises = JSON.parse(await readFile(new URL('./fixtures/free-exercise-db/exercises.json', import.meta.url), 'utf8'))
const mediaBaseUrl = 'https://media.coachfitpro.com.br'

const coachExercises = [
  { name: 'Barbell Bench Press - Medium Grip', equipment: 'Barra' },
  { name: 'Supino reto com barra', aliases: ['bench press'], equipment: 'Barra' },
  { name: 'Supino inclinado com halteres', aliases: ['bench press'], equipment: 'Halteres' },
  { name: 'Supino reto na máquina', aliases: ['bench press'], equipment: 'Máquina' },
  { name: 'Rosca direta com barra', aliases: ['barbell curl'], equipment: 'Barra' },
]

test('ignora o separador repassado pelo pnpm ao interpretar argumentos', () => {
  assert.deepEqual(
    parseExerciseMediaArgs(['--', '--dataset', 'C:/dataset', '--report', 'coverage.json']),
    { upload: false, dataset: 'C:/dataset', report: 'coverage.json' },
  )
})

test('executa o Wrangler por shell no Windows para suportar pnpm.cmd', () => {
  const command = buildWranglerUploadCommand({
    bucket: 'media',
    sourceFile: 'C:/Coach fit/dataset/sample.jpg',
    upload: { key: 'exercise/start.jpg', contentType: 'image/jpeg' },
    platform: 'win32',
    comspec: 'C:/Windows/System32/cmd.exe',
  })

  assert.equal(command.executable, 'C:/Windows/System32/cmd.exe')
  assert.equal(command.shell, false)
  assert.deepEqual(command.args.slice(0, 3), ['/d', '/s', '/c'])
  assert.match(command.args[3], /--file "C:\/Coach fit\/dataset\/sample\.jpg"/)
})

test('usa caminho relativo quando a imagem está dentro do projeto', () => {
  assert.equal(
    resolveUploadSourceFile('C:/Coach fit/project', 'C:/Coach fit/project/media/start.jpg'),
    'media\\start.jpg',
  )
})

test('gera plano estável com correspondência exata e compatível por equipamento', () => {
  const first = buildExerciseMediaPlan({ coachExercises, datasetExercises, mediaBaseUrl })
  const second = buildExerciseMediaPlan({ coachExercises, datasetExercises, mediaBaseUrl })

  assert.deepEqual(second, first)
  assert.equal(first.matched.length, 3)
  assert.equal(first.unmatched.length, 1)
  assert.equal(first.ambiguous.length, 1)
  assert.equal(first.manifest['barbell bench press medium grip'].matchType, 'exact')
  assert.equal(first.manifest['supino reto com barra'].sourceId, 'Barbell_Bench_Press_-_Medium_Grip')
  assert.equal(first.manifest['supino inclinado com halteres'].sourceId, 'Incline_Dumbbell_Press')
  assert.equal(first.manifest['supino reto na maquina'], undefined)
  assert.equal(first.manifest['rosca direta com barra'], undefined)
})

test('usa chaves versionadas e somente o domínio oficial no manifesto', () => {
  const plan = buildExerciseMediaPlan({ coachExercises: coachExercises.slice(0, 1), datasetExercises, mediaBaseUrl })
  const [start, finish] = plan.manifest['barbell bench press medium grip'].images

  assert.equal(start.role, 'start')
  assert.equal(finish.role, 'finish')
  assert.equal(start.url, `${mediaBaseUrl}/free-exercise-db/v1/barbell-bench-press-medium-grip/start.jpg`)
  assert.equal(finish.url, `${mediaBaseUrl}/free-exercise-db/v1/barbell-bench-press-medium-grip/finish.jpg`)
  assert.deepEqual(plan.uploads.map((upload) => upload.key), [
    'free-exercise-db/v1/barbell-bench-press-medium-grip/finish.jpg',
    'free-exercise-db/v1/barbell-bench-press-medium-grip/start.jpg',
  ])
})

test('valida a existência de todas as imagens planejadas', async () => {
  const plan = buildExerciseMediaPlan({ coachExercises: coachExercises.slice(0, 3), datasetExercises, mediaBaseUrl })
  assert.deepEqual(await validatePlannedSourceFiles(plan.uploads, fixtureRoot), [])

  const missing = await validatePlannedSourceFiles([
    ...plan.uploads,
    { key: 'missing.jpg', sourcePath: 'exercises/missing/0.jpg' },
  ], fixtureRoot)
  assert.deepEqual(missing, ['exercises/missing/0.jpg'])
})

test('não confunde equipamento citado nos aliases com o movimento executado', () => {
  const plan = buildExerciseMediaPlan({
    coachExercises: [{
      name: 'Panturrilha no leg press',
      equipment: 'Leg press',
      aliases: ['calf raise', 'leg press'],
    }],
    datasetExercises: [{
      id: 'Leg_Press',
      name: 'Leg Press',
      equipment: 'machine',
      images: ['Leg_Press/0.jpg', 'Leg_Press/1.jpg'],
    }],
    mediaBaseUrl,
  })

  assert.equal(plan.matched.length, 0)
  assert.equal(plan.unmatched.length, 1)
})

test('trata barra fixa como peso corporal ao selecionar Pullups', () => {
  const plan = buildExerciseMediaPlan({
    coachExercises: [{ name: 'Barra fixa', equipment: 'Barra fixa' }],
    datasetExercises: [{
      id: 'Pullups',
      name: 'Pullups',
      equipment: 'body only',
      images: ['Pullups/0.jpg', 'Pullups/1.jpg'],
    }],
    mediaBaseUrl,
  })

  assert.equal(plan.matched.length, 1)
  assert.equal(plan.manifest['barra fixa'].sourceId, 'Pullups')
})
