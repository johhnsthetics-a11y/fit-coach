import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { canSignWorkoutVideo, normalizeWorkoutVideoPath } from '../supabase/functions/_shared/workoutVideoAccess.ts'

const workoutId = '11111111-1111-4111-8111-111111111111'
const path = `${workoutId}/01-1234567890123.mp4`
const workouts = [{ id: workoutId, workout_exercises: [{ video_url: path }] }]

test('only a video belonging to an authorized workout can be signed', () => {
  assert.equal(canSignWorkoutVideo(workouts, workoutId, path), true)
  assert.equal(canSignWorkoutVideo(workouts, workoutId, `${workoutId}/02-other.mp4`), false)
  assert.equal(canSignWorkoutVideo(workouts, '22222222-2222-4222-8222-222222222222', path), false)
  assert.equal(canSignWorkoutVideo(workouts, workoutId, `${workoutId}/../private.mp4`), false)
  assert.equal(canSignWorkoutVideo([], workoutId, path), false)
})

test('legacy Storage URLs resolve to the exact stored object path', () => {
  assert.equal(normalizeWorkoutVideoPath(`https://example.supabase.co/storage/v1/object/public/workout-videos/${path}`), path)
  assert.equal(normalizeWorkoutVideoPath(`https://example.supabase.co/storage/v1/object/sign/workout-videos/${path}?token=abc`), path)
  assert.equal(normalizeWorkoutVideoPath('https://external.example/video.mp4'), '')
})

test('student access signs through the invite-scoped function, never a raw Storage fallback', async () => {
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  assert.match(api, /hydrateWorkoutRow\(row, \{ inviteCode: code \}\)/)
  assert.match(api, /functionRequest\('workout-video', \{ inviteCode, workoutId: workout\.id, videoPath: path \}\)/)
  assert.match(api, /videoUrl: signedUrl \|\| ''/)
  const edge = await readFile(new URL('../supabase/functions/workout-video/index.ts', import.meta.url), 'utf8')
  assert.match(edge, /rpc\('get_student_workouts'/)
  assert.match(edge, /canSignWorkoutVideo\(workouts, workoutId, videoPath\)/)
})

test('Storage policy removes public access and scopes coach operations to owned workouts', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261116153441_private_workout_videos.sql', import.meta.url), 'utf8')
  assert.match(sql, /update storage\.buckets set public = false where id = 'workout-videos'/i)
  assert.match(sql, /drop policy if exists "coach workout videos read" on storage\.objects/i)
  assert.match(sql, /for select to authenticated/i)
  assert.match(sql, /w\.coach_id = \(select auth\.uid\(\)\)/i)
  assert.doesNotMatch(sql, /for select to anon/i)
  assert.match(sql, /drop policy if exists "authenticated checkin photos read" on storage\.objects/i)
})
