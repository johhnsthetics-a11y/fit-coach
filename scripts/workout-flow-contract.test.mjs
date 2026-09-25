import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

const apiSource = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const migrationSource = await readFile(new URL('../supabase/migrations/20260915_workout_flow_readiness.sql', import.meta.url), 'utf8').catch(() => '')
const renamedReferenceFixSource = await readFile(new URL('../supabase/migrations/20260925_fix_workout_session_renamed_refs.sql', import.meta.url), 'utf8').catch(() => '')
const cssSource = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('rascunho permanece privado e publicação fica disponível ao aluno', () => {
  assert.match(apiSource, /publication_status:\s*workout\.status === 'Rascunho' \? 'draft' : 'published'/)
  assert.match(migrationSource, /workout_payload ->> 'publication_status'/i)
  assert.match(migrationSource, /active\s*=\s*v_is_published/i)
  assert.match(migrationSource, /workouts\.active is true/i)
})

test('portal de treinos valida convite e vínculo antes de retornar dados', () => {
  assert.match(apiSource, /rpcRequest\('get_student_workouts',\s*\{ invite_code: code \}\)/)
  assert.match(migrationSource, /create or replace function public\.get_student_workouts\(invite_code text\)/i)
  assert.match(migrationSource, /student_invites\.status = 'active'/i)
  assert.match(migrationSource, /student_invites\.expires_at is null or student_invites\.expires_at > now\(\)/i)
  assert.match(migrationSource, /students\.coach_id = v_coach_id/i)
  assert.match(migrationSource, /workouts\.student_id = v_student_id/i)
  assert.match(migrationSource, /workouts\.coach_id = v_coach_id/i)
  assert.match(migrationSource, /workouts\.active is true/i)
})

test('execução parcial possui persistência remota e retomada', () => {
  assert.match(apiSource, /rpcRequest\('get_student_workout_session'/)
  assert.match(apiSource, /rpcRequest\('save_student_workout_session'/)
  assert.match(migrationSource, /create table if not exists public\.workout_sessions/i)
  assert.match(migrationSource, /create or replace function public\.get_student_workout_session/i)
  assert.match(migrationSource, /create or replace function public\.save_student_workout_session/i)
  assert.match(appSource, /onLoadWorkoutSession/)
  assert.match(appSource, /onSaveWorkoutSession/)
})

test('conclusão fecha a sessão e cria um único log', () => {
  assert.match(apiSource, /rpcRequest\('complete_student_workout_session'/)
  assert.match(migrationSource, /create or replace function public\.complete_student_workout_session/i)
  assert.match(migrationSource, /pg_advisory_xact_lock/i)
  assert.match(migrationSource, /update public\.workout_sessions[\s\S]*status = 'completed'/i)
  assert.match(migrationSource, /insert into public\.workout_logs/i)
})

test('aluno pode escolher entre vários treinos publicados', () => {
  const studentAppSource = appSource.match(/function StudentMobileApp[\s\S]*?\r?\nfunction StudentHomeDashboard/)?.[0] || ''
  assert.match(studentAppSource, /selectedStudentWorkoutId/)
  assert.match(studentAppSource, /student-workout-selector/)
  assert.doesNotMatch(studentAppSource, /workout=\{studentWorkouts\[0\]\}/)
})


test('funções renomeadas de sessão não mantêm referências ao nome antigo', () => {
  assert.match(renamedReferenceFixSource, /save_student_workout_session_unchecked\.completion_token/)
  assert.match(renamedReferenceFixSource, /complete_student_workout_session_unchecked\.completion_token/)
  assert.doesNotMatch(renamedReferenceFixSource, /replace\([\s\S]*?'save_student_workout_session\.completion_token'[\s\S]*?'save_student_workout_session\.completion_token'/)
  assert.doesNotMatch(renamedReferenceFixSource, /replace\([\s\S]*?'complete_student_workout_session\.completion_token'[\s\S]*?'complete_student_workout_session\.completion_token'/)
})

test('conclusão de treino mantém recompensa visual de XP para o aluno', () => {
  assert.match(appSource, /student-xp-gain/)
  assert.match(appSource, /\+80 XP/)
  assert.match(cssSource, /\.student-xp-gain[\s\S]*?animation:\s*student-xp-enter/)
  assert.match(cssSource, /@keyframes\s+student-xp-enter/)
})
