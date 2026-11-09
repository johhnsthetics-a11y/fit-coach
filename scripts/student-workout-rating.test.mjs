import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const panel = await readFile(new URL('../src/WorkoutCompletionRating.jsx', import.meta.url), 'utf8')
const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const xpCelebrationCss = await readFile(new URL('../src/student-workout-xp-celebration-build35.css', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261103131000_student_workout_rating_meal_photos.sql', import.meta.url), 'utf8')

test('painel de estrelas aparece após treino completo e a prévia nunca envia avaliação', () => {
  assert.match(app, /!summaryLog\?\.endedEarly \? <WorkoutCompletionRating[\s\S]{0,180}preview=\{preview\}/)
  assert.match(panel, /if \(!log\?\.id \|\| log\.endedEarly\) return null/)
  assert.match(panel, /onSubmit\(selectedRating\)/)
  assert.match(panel, /aria-pressed=\{selectedRating === value\}/)
  assert.match(panel, /Avalie o treino de uma a cinco estrelas/)
  assert.match(panel, /if \(preview \|\| saving \|\| selectedRating < 1/)
  assert.match(panel, /disabled=\{preview \|\| saving \|\| selectedRating < 1\}/)
  assert.match(panel, /A avaliação real será enviada pelo aluno no app\./)
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

test('BUILD35 só celebra XP real depois da confirmação do rating salvo', () => {
  const handler = app.match(/async function submitWorkoutRating\(rating\) \{([\s\S]*?)\n  \}/)?.[1] || ''
  const persistedRatingCheck = handler.indexOf('if (!saved?.id)')
  const celebrationStart = handler.indexOf('setXpCelebration({ xp: xpAwarded')

  assert.match(handler, /if \(preview\) throw new Error\('A prévia não salva avaliações do aluno\.'\)/)
  assert.match(handler, /await onRateWorkout\(completedLog\.id, selectedRating\)/)
  assert.ok(persistedRatingCheck >= 0 && celebrationStart > persistedRatingCheck, 'a celebração só pode abrir depois da confirmação de persistência')
  assert.match(handler, /const xpAwarded = Math\.max\(0, Math\.trunc\(Number\(completedLog\.xpAwarded\) \|\| 0\)\)/)
  assert.match(handler, /if \(xpAwarded > 0 && celebratedCompletionIdRef\.current !== completionId\)/)
  assert.match(handler, /if \(completedLog\.endedEarly\) throw/)
  assert.match(app, /role="dialog"\s+aria-modal="true"/)
  assert.match(app, /aria-label="Estrelas da avaliação salva"/)
  assert.match(app, /onXpCelebrationStart\?\.\(\)/)
  assert.match(app, /previousRewardRef\.current = \{ studentId: student\?\.id, xp: rewardTotal \}/)
  assert.match(app, /xpGain > 0 && activeTab !== 'treino'/)
  assert.match(xpCelebrationCss, /--xp-accent:\s*#4EE9D0/)
  assert.match(xpCelebrationCss, /--xp-accent:\s*#087F72/)
  assert.match(xpCelebrationCss, /@media \(prefers-reduced-motion:\s*reduce\)/)
  assert.match(xpCelebrationCss, /position:\s*fixed/)
  assert.match(mainSource, /import '\.\/student-workout-xp-celebration-build35\.css'/)
})

test('BUILD32 usa somente estrelas na escala visual sem retirar nomes acessíveis ou valores internos', () => {
  assert.match(panel, /<span aria-hidden="true">★<\/span>/)
  assert.match(panel, /aria-label=\{`\$\{value\}/)
  assert.match(panel, /Avaliação selecionada\. Toque nas estrelas para ajustar\./)
  assert.doesNotMatch(panel, /\$\{selectedRating\} de 5/)
  assert.match(panel, /const STAR_VALUES = \[1, 2, 3, 4, 5\]/)
})
