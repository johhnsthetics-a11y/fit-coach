import { createClient } from 'npm:@supabase/supabase-js@2.91.0'
import { canSignWorkoutVideo, normalizeWorkoutVideoPath } from '../_shared/workoutVideoAccess.ts'

const url = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('FITCOACH_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
}
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return reply({ ok: true })
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405)
  if (!url || !anonKey || !serviceKey) return reply({ error: 'Vídeo indisponível.' }, 503)
  try {
    const body = await request.json()
    const inviteCode = String(body?.inviteCode ?? '').trim()
    const workoutId = String(body?.workoutId ?? '')
    const videoPath = normalizeWorkoutVideoPath(body?.videoPath)
    if (!inviteCode || inviteCode.length > 256 || !videoPath) return reply({ error: 'Solicitação inválida.' }, 400)

    // The existing RPC enforces an active invite, assigned student and financial access.
    const reader = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: workouts, error: accessError } = await reader.rpc('get_student_workouts', { invite_code: inviteCode })
    if (accessError || !canSignWorkoutVideo(workouts, workoutId, videoPath)) {
      return reply({ error: 'Vídeo não autorizado.' }, 403)
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await admin.storage.from('workout-videos').createSignedUrl(videoPath, 3600)
    if (error || !data?.signedUrl) return reply({ error: 'Vídeo indisponível.' }, 404)
    return reply({ signedUrl: data.signedUrl })
  } catch {
    return reply({ error: 'Não foi possível abrir o vídeo.' }, 500)
  }
})
