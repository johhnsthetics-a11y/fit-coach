import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const panel = await readFile(new URL('../src/WorkoutCompletionRating.jsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261103131000_student_workout_rating_meal_photos.sql', import.meta.url), 'utf8')

test('painel de estrelas aparece somente após treino completo fora da prévia e de encerramento parcial', () => {
  assert.match(app, /!preview && !completedLog\?\.endedEarly[\s\S]{0,140}<WorkoutCompletionRating/)
  assert.match(panel, /if \(!log\?\.id \|\| log\.endedEarly\) return null/)
  assert.match(panel, /onSubmit\(selectedRating\)/)
  assert.match(panel, /aria-pressed=\{selectedRating === value\}/)
  assert.match(panel, /Avalie o treino de uma a cinco estrelas/)
})

test('rating valida faixa, convite financeiro e log de conclusão real sem criar um segundo log', () => {
  assert.match(api, /rpcRequest\('rate_student_workout_log'/)
  assert.match(api, /selected_workout_log_id: workoutLogId/)
  assert.match(migration, /add column if not exists rating smallint/i)
  assert.match(migration, /check \(rating is null or rating between 1 and 5\)/i)
  assert.match(migration, /public\.coachfit_student_financial_access_by_invite\(invite_code\)/i)
  assert.match(migration, /update public\.workout_logs as logs/i)
  assert.match(migration, /position\('\[coachfitpro-completion:' in coalesce\(logs\.notes, ''\)\) > 0/i)
  assert.match(migration, /position\('\[coachfitpro-ended-early:' in coalesce\(logs\.notes, ''\)\) = 0/i)
  assert.match(migration, /grant execute on function public\.rate_student_workout_log\(text, uuid, smallint\) to anon, authenticated/i)
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|all)[^;]*workout_logs[^;]*\bto\s+anon/i)
  assert.match(api, /rating: Number\(row\.rating\)[\s\S]{0,100}ratedAt: row\.rated_at/)
})
