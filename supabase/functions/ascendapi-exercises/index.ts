const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RAPIDAPI_KEY = Deno.env.get('ASCENDAPI_RAPIDAPI_KEY') ?? ''
const RAPIDAPI_HOST = Deno.env.get('ASCENDAPI_RAPIDAPI_HOST') ?? 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true }, 200)
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RAPIDAPI_KEY || !RAPIDAPI_HOST) {
    return jsonResponse({ ok: false, error: 'AscendAPI environment not configured' }, 500)
  }

  const body = await request.json().catch(() => ({}))
  const query = String(body.query || '').trim()
  const exerciseId = String(body.exerciseId || '').trim()

  if (!query && !exerciseId) {
    return jsonResponse({ ok: false, error: 'Informe query ou exerciseId.' }, 400)
  }

  const cached = query ? await findCachedExercise(query) : null
  if (cached?.videoUrl || cached?.imageUrl) {
    return jsonResponse({ ok: true, source: 'cache', exercise: cached }, 200)
  }

  const exercise = exerciseId
    ? await fetchExerciseById(exerciseId)
    : await searchAndHydrateExercise(query)

  if (!exercise?.name) {
    return jsonResponse({ ok: false, error: 'Exercicio nao encontrado na AscendAPI.' }, 404)
  }

  await upsertExercise(exercise).catch(() => null)
  return jsonResponse({ ok: true, source: 'ascendapi', exercise }, 200)
})

async function searchAndHydrateExercise(query: string) {
  const searchPayload = await rapidRequest(`/api/v1/exercises/search?search=${encodeURIComponent(query)}`)
  const items = Array.isArray(searchPayload?.data) ? searchPayload.data : []
  const best = items[0]
  if (!best) return null

  const id = findString(best, ['exerciseId', 'id'])
  if (!id) return normalizeExercise(best)

  return await fetchExerciseById(id)
}

async function fetchExerciseById(exerciseId: string) {
  const payload = await rapidRequest(`/api/v1/exercises/${encodeURIComponent(exerciseId)}`)
  return normalizeExercise(payload?.data || payload)
}

async function rapidRequest(path: string) {
  const response = await fetch(`https://${RAPIDAPI_HOST}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  })

  const text = await response.text()
  let payload: Record<string, unknown> = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!response.ok) {
    throw new Error(findString(payload, ['message', 'error']) || `AscendAPI error ${response.status}`)
  }

  return payload
}

async function findCachedExercise(query: string) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/exercise_library`)
  url.searchParams.set('select', '*')
  url.searchParams.set('active', 'eq.true')
  url.searchParams.set('name', `ilike.*${query}*`)
  url.searchParams.set('limit', '1')

  const rows = await supabaseRequest(url.toString())
  const row = Array.isArray(rows) ? rows[0] : null
  return row ? fromExerciseRow(row) : null
}

async function upsertExercise(exercise: Record<string, unknown>) {
  const payload = {
    name: exercise.name,
    muscle_group: exercise.group || 'Movimento',
    equipment: exercise.equipment || '',
    instructions: exercise.cues || '',
    video_url: exercise.videoUrl || '',
    image_url: exercise.imageUrl || '',
    thumbnail_url: exercise.thumbnailUrl || exercise.imageUrl || '',
    external_id: exercise.externalId || exercise.exerciseId || '',
    aliases: exercise.aliases || [],
    source_payload: exercise.raw || {},
    active: true,
    updated_at: new Date().toISOString(),
  }

  return supabaseRequest(`${SUPABASE_URL}/rest/v1/exercise_library?on_conflict=name`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  })
}

async function supabaseRequest(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(text || `Supabase error ${response.status}`)
  return text ? JSON.parse(text) : null
}

function normalizeExercise(input: Record<string, unknown> | null) {
  if (!input) return null
  const name = findString(input, ['name', 'exerciseName', 'title'])
  const targetMuscles = findArray(input, ['targetMuscles', 'target_muscles', 'primaryMuscles', 'muscles'])
  const secondaryMuscles = findArray(input, ['secondaryMuscles', 'secondary_muscles'])
  const bodyParts = findArray(input, ['bodyParts', 'body_parts', 'bodyPart'])
  const equipments = findArray(input, ['equipments', 'equipment', 'equipmentNames'])
  const instructions = findInstructions(input)
  const videoUrl = findString(input, ['videoUrl', 'video_url', 'video', 'gifUrl', 'gif_url', 'animationUrl'])
  const imageUrl = findString(input, ['imageUrl', 'image_url', 'image', 'thumbnailUrl', 'thumbnail_url'])
  const exerciseId = findString(input, ['exerciseId', 'id'])

  return {
    exerciseId,
    externalId: exerciseId,
    name,
    group: targetMuscles[0] || bodyParts[0] || '',
    equipment: equipments.join(', '),
    cues: instructions,
    videoUrl,
    imageUrl,
    thumbnailUrl: imageUrl,
    aliases: name ? [name] : [],
    targetMuscles,
    secondaryMuscles,
    bodyParts,
    raw: input,
  }
}

function findInstructions(input: Record<string, unknown>) {
  const candidates = [
    input.instructions,
    input.instruction,
    input.steps,
    input.description,
    input.overview,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map(String).join('\n')
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  return ''
}

function findString(input: unknown, keys: string[]) {
  if (!input || typeof input !== 'object') return ''
  const record = input as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function findArray(input: unknown, keys: string[]) {
  if (!input || typeof input !== 'object') return []
  const record = input as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') return findString(item, ['name', 'label', 'title'])
          return ''
        })
        .filter(Boolean)
    }
    if (typeof value === 'string' && value.trim()) return [value.trim()]
  }
  return []
}

function fromExerciseRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    externalId: row.external_id,
    exerciseId: row.external_id,
    name: row.name,
    group: row.muscle_group,
    equipment: row.equipment,
    cues: row.instructions,
    videoUrl: row.video_url,
    imageUrl: row.image_url || row.thumbnail_url,
    thumbnailUrl: row.thumbnail_url || row.image_url,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
  }
}

function jsonResponse(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
