import { exerciseMediaManifest } from './data/exerciseMediaManifest.js'

const MEDIA_HOST = 'media.coachfitpro.com.br'

const equipmentMatchers = [
  ['barbell', /\b(barra|barbell)\b/],
  ['dumbbell', /\b(halter|halteres|dumbbell|dumbbells)\b/],
  ['cable', /\b(polia|cabo|cabos|cable|cables)\b/],
  ['machine', /\b(maquina|machine)\b/],
  ['bodyweight', /\b(peso corporal|bodyweight)\b/],
  ['band', /\b(elastico|band|bands)\b/],
  ['smith', /\bsmith\b/],
  ['kettlebell', /\b(kettlebell)\b/],
  ['trx', /\btrx\b/],
]

export function normalizeExerciseMediaKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function getEquipmentKeys(value) {
  const normalized = normalizeExerciseMediaKey(value)
  return equipmentMatchers
    .filter(([, matcher]) => matcher.test(normalized))
    .map(([key]) => key)
}

function isOfficialMediaUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' && url.hostname === MEDIA_HOST
  } catch {
    return false
  }
}

function isValidMediaRecord(record) {
  if (!record || record.source !== 'free-exercise-db' || !record.sourceId) return false
  if (!['exact', 'compatible'].includes(record.matchType)) return false
  if (!Array.isArray(record.images)) return false

  const start = record.images.find((image) => image?.role === 'start')
  const finish = record.images.find((image) => image?.role === 'finish')
  return Boolean(start && finish && isOfficialMediaUrl(start.url) && isOfficialMediaUrl(finish.url))
}

function equipmentIsCompatible(exercise, record) {
  const expected = Array.isArray(record.equipment) ? record.equipment.filter(Boolean) : []
  const actual = getEquipmentKeys(exercise.equipment)
  if (!expected.length || !actual.length) return true
  return actual.some((key) => expected.includes(key))
}

export function resolveExerciseMedia(exercise = {}, manifest = exerciseMediaManifest) {
  if (exercise.videoPreviewUrl || exercise.videoUrl || exercise.video_url) return null

  const candidateKeys = [exercise.name, ...(Array.isArray(exercise.aliases) ? exercise.aliases : [])]
    .map(normalizeExerciseMediaKey)
    .filter(Boolean)

  for (const key of candidateKeys) {
    const record = manifest?.[key]
    if (!isValidMediaRecord(record)) continue
    if (!equipmentIsCompatible(exercise, record)) continue
    return record
  }

  return null
}

export function getExerciseMediaStartImage(exercise = {}, manifest = exerciseMediaManifest) {
  const media = resolveExerciseMedia(exercise, manifest)
  return media?.images?.find((image) => image.role === 'start')?.url || ''
}
