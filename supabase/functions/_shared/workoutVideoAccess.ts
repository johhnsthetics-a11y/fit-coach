const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VIDEO_PATH = /^([0-9a-f-]{36})\/[a-zA-Z0-9._-]+\.(mp4|webm|mov|m4v)$/i

export function normalizeWorkoutVideoPath(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 512) return ''
  let path = value
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      if (!url.hostname.endsWith('.supabase.co')) return ''
      const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/workout-videos\/(.+)$/)
      if (!match) return ''
      path = decodeURIComponent(match[1])
    } catch {
      return ''
    }
  }
  if (path.includes('..') || path.includes('%') || path.includes('\\') || path.includes('//')) return ''
  const match = path.match(VIDEO_PATH)
  return match && UUID.test(match[1]) ? path : ''
}

export function canSignWorkoutVideo(workouts: unknown, workoutId: unknown, videoPath: unknown): boolean {
  if (typeof workoutId !== 'string' || !UUID.test(workoutId)) return false
  const path = normalizeWorkoutVideoPath(videoPath)
  if (!path || !path.toLowerCase().startsWith(`${workoutId.toLowerCase()}/`)) return false
  if (!Array.isArray(workouts)) return false
  const workout = workouts.find((item) => item?.id === workoutId)
  return Array.isArray(workout?.workout_exercises) && workout.workout_exercises.some(
    (exercise: { video_url?: unknown }) => normalizeWorkoutVideoPath(exercise.video_url) === path,
  )
}
