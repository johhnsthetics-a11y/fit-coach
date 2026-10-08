import { access } from 'node:fs/promises'
import path from 'node:path'
import { normalizeExerciseMediaKey } from '../../src/exerciseMedia.js'
import { coachfitMediaAliases } from './coachfitMediaAliases.mjs'

const genericTerms = new Set(['press', 'row', 'curl', 'raise', 'squat', 'abs'])

const equipmentMatchers = [
  ['barbell', /\b(barra(?! fixa)|barbell)\b/],
  ['dumbbell', /\b(halter|halteres|dumbbell|dumbbells)\b/],
  ['cable', /\b(polia|cabo|cabos|cable|cables)\b/],
  ['machine', /\b(maquina|machine)\b/],
  ['bodyweight', /\b(peso corporal|barra fixa|body only|bodyweight)\b/],
  ['band', /\b(elastico|band|bands)\b/],
  ['smith', /\bsmith\b/],
  ['kettlebell', /\bkettlebell\b/],
  ['trx', /\btrx\b/],
]

export function parseExerciseMediaArgs(values) {
  const options = { upload: false }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === '--') continue
    if (value === '--upload') options.upload = true
    else if (value.startsWith('--')) options[value.slice(2)] = values[index += 1]
  }
  return options
}

export function buildWranglerUploadCommand({
  bucket,
  sourceFile,
  upload,
  platform = process.platform,
  comspec = process.env.ComSpec || 'cmd.exe',
}) {
  const args = [
    'dlx', 'wrangler@4', 'r2', 'object', 'put', `${bucket}/${upload.key}`,
    '--file', sourceFile,
    '--content-type', upload.contentType,
    '--remote',
  ]
  if (platform !== 'win32') return { executable: 'pnpm', args, shell: false }

  const commandLine = ['pnpm', ...args]
    .map((value) => /\s/.test(value) ? `"${String(value).replaceAll('"', '""')}"` : value)
    .join(' ')
  return {
    executable: comspec,
    args: ['/d', '/s', '/c', commandLine],
    shell: false,
  }
}

export function resolveUploadSourceFile(projectRoot, sourceFile) {
  const relative = path.relative(projectRoot, sourceFile)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : sourceFile
}

function getEquipmentKeys(value) {
  const normalized = normalizeExerciseMediaKey(value)
  return equipmentMatchers
    .filter(([, matcher]) => matcher.test(normalized))
    .map(([key]) => key)
}

function equipmentIsCompatible(coachExercise, datasetExercise) {
  const coachKeys = getEquipmentKeys(coachExercise.equipment)
  const datasetKeys = getEquipmentKeys(datasetExercise.equipment)
  if (!coachKeys.length || !datasetKeys.length) return true
  return coachKeys.some((key) => datasetKeys.includes(key))
}

function normalizeDatasetExercise(exercise) {
  const images = Array.isArray(exercise?.images) ? exercise.images.filter(Boolean).slice(0, 2) : []
  return {
    ...exercise,
    id: String(exercise?.id || exercise?.name || ''),
    name: String(exercise?.name || ''),
    normalizedName: normalizeExerciseMediaKey(exercise?.name),
    equipment: String(exercise?.equipment || ''),
    images,
  }
}

function buildCandidateTerms(exercise) {
  const key = normalizeExerciseMediaKey(exercise.name)
  const curated = (coachfitMediaAliases[key] || [])
    .map(normalizeExerciseMediaKey)
    .filter(Boolean)
    .filter((term, index, terms) => terms.indexOf(term) === index)
  return {
    exact: [normalizeExerciseMediaKey(exercise.name), ...curated]
      .filter(Boolean)
      .filter((term, index, terms) => terms.indexOf(term) === index),
    compatible: curated,
  }
}

function isUsefulCompatibleTerm(term) {
  return term.split(' ').length >= 2 && !genericTerms.has(term)
}

function getMediaExtension(imagePath) {
  const extension = path.posix.extname(String(imagePath || '')).toLowerCase()
  return /^\.(jpe?g|png|webp)$/.test(extension) ? extension.slice(1) : 'jpg'
}

function getSourcePath(imagePath) {
  const normalized = String(imagePath || '').replaceAll('\\', '/').replace(/^\/+/, '')
  return normalized.startsWith('exercises/') ? normalized : `exercises/${normalized}`
}

function chooseDatasetExercise(coachExercise, datasetExercises) {
  const terms = buildCandidateTerms(coachExercise)
  const compatible = datasetExercises.filter((exercise) => equipmentIsCompatible(coachExercise, exercise))
  const exact = compatible.filter((exercise) => terms.exact.includes(exercise.normalizedName))

  if (exact.length === 1) return { exercise: exact[0], matchType: 'exact' }
  if (exact.length > 1) return { ambiguous: exact }

  const candidates = compatible
    .map((exercise) => {
      const matchingTerms = terms.compatible.filter((term) => (
        isUsefulCompatibleTerm(term)
        && (exercise.normalizedName.includes(term) || term.includes(exercise.normalizedName))
      ))
      const score = Math.max(0, ...matchingTerms.map((term) => term.split(' ').length))
      return { exercise, score }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.normalizedName.localeCompare(b.exercise.normalizedName))

  if (!candidates.length) return {}
  const best = candidates.filter((candidate) => candidate.score === candidates[0].score)
  if (best.length > 1) return { ambiguous: best.map((candidate) => candidate.exercise) }
  return { exercise: best[0].exercise, matchType: 'compatible' }
}

function buildMediaRecord(datasetExercise, matchType, mediaBaseUrl) {
  const slug = normalizeExerciseMediaKey(datasetExercise.id).replaceAll(' ', '-')
  const [startPath, finishPath] = datasetExercise.images
  const startExtension = getMediaExtension(startPath)
  const finishExtension = getMediaExtension(finishPath)
  const base = `${mediaBaseUrl.replace(/\/$/, '')}/free-exercise-db/v1/${slug}`
  return {
    record: {
      source: 'free-exercise-db',
      sourceId: datasetExercise.id,
      matchType,
      equipment: getEquipmentKeys(datasetExercise.equipment),
      images: [
        { role: 'start', url: `${base}/start.${startExtension}` },
        { role: 'finish', url: `${base}/finish.${finishExtension}` },
      ],
    },
    uploads: [
      { key: `free-exercise-db/v1/${slug}/start.${startExtension}`, sourcePath: getSourcePath(startPath), contentType: `image/${startExtension === 'jpg' ? 'jpeg' : startExtension}` },
      { key: `free-exercise-db/v1/${slug}/finish.${finishExtension}`, sourcePath: getSourcePath(finishPath), contentType: `image/${finishExtension === 'jpg' ? 'jpeg' : finishExtension}` },
    ],
  }
}

export function buildExerciseMediaPlan({ coachExercises = [], datasetExercises = [], mediaBaseUrl }) {
  const normalizedDataset = datasetExercises
    .map(normalizeDatasetExercise)
    .filter((exercise) => exercise.id && exercise.normalizedName && exercise.images.length === 2)
    .sort((a, b) => a.normalizedName.localeCompare(b.normalizedName) || a.id.localeCompare(b.id))
  const manifest = {}
  const matched = []
  const unmatched = []
  const ambiguous = []
  const uploadsByKey = new Map()

  const sortedCoachExercises = [...coachExercises].sort((a, b) => (
    normalizeExerciseMediaKey(a.name).localeCompare(normalizeExerciseMediaKey(b.name))
  ))

  for (const coachExercise of sortedCoachExercises) {
    const key = normalizeExerciseMediaKey(coachExercise.name)
    const selection = chooseDatasetExercise(coachExercise, normalizedDataset)
    if (selection.ambiguous) {
      ambiguous.push({
        name: coachExercise.name,
        candidates: selection.ambiguous.map((exercise) => exercise.id).sort(),
      })
      continue
    }
    if (!selection.exercise) {
      unmatched.push({ name: coachExercise.name, equipment: coachExercise.equipment || '' })
      continue
    }

    const media = buildMediaRecord(selection.exercise, selection.matchType, mediaBaseUrl)
    manifest[key] = media.record
    matched.push({
      name: coachExercise.name,
      sourceId: selection.exercise.id,
      matchType: selection.matchType,
    })
    media.uploads.forEach((upload) => uploadsByKey.set(upload.key, upload))
  }

  return {
    manifest,
    matched,
    unmatched,
    ambiguous,
    uploads: [...uploadsByKey.values()].sort((a, b) => a.key.localeCompare(b.key)),
  }
}

export async function validatePlannedSourceFiles(uploads, datasetRoot) {
  const missing = []
  for (const upload of uploads) {
    try {
      await access(path.join(datasetRoot, upload.sourcePath))
    } catch {
      missing.push(upload.sourcePath)
    }
  }
  return [...new Set(missing)].sort()
}
