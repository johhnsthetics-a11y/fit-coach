import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const journal = await readFile(new URL('../src/StudentMealPhotoJournal.jsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261103131000_student_workout_rating_meal_photos.sql', import.meta.url), 'utf8')

test('botão para registrar refeição fica na aba Dieta mesmo quando ainda não há plano liberado', () => {
  const diet = app.match(/if \(activeTab === 'dieta'\)[\s\S]*?if \(activeTab === 'checkin'\)/)?.[0] || ''
  assert.match(diet, /<StudentMealPhotoJournal/)
  assert.ok(diet.indexOf('<StudentMealPhotoJournal') < diet.indexOf('{studentNutritionPlans.length ?'))
  assert.match(diet, /onSave=\{saveStudentMealPhoto\}/)
  assert.match(app, /onLoadMealLogs/)
  assert.match(app, /loadRemoteStudentMealLogs\(inviteCode\)/)
})

test('form aceita foto da câmera/galeria, mostra preview e exige confirmação do registro', () => {
  assert.match(journal, /accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif,image\/avif"/)
  assert.match(journal, /capture="environment"/)
  assert.match(journal, /URL\.createObjectURL\(photoFile\)/)
  assert.match(journal, /await onSave\(\{/)
  assert.match(journal, /photoFile: optimizedPhoto/)
  assert.match(journal, /if \(!savedLog\?\.id\)/)
  assert.match(journal, /aria-label="Atualizar refeições registradas"/)
  assert.match(journal, /MAX_PHOTO_BYTES = 15 \* 1024 \* 1024/)
  assert.match(journal, /MAX_STORED_PHOTO_BYTES = 10 \* 1024 \* 1024/)
})

test('API salva no bucket privado, gera URL assinada e não habilita upload público ou upsert', () => {
  assert.match(api, /const MEAL_PHOTO_BUCKET = 'meal-photos'/)
  assert.match(api, /rpcRequest\('create_student_meal_log'/)
  assert.match(api, /rpcRequest\('get_student_meal_logs'/)
  assert.match(api, /signStudentMealPhoto\(inviteCode, mealLog\.id\)/)
  assert.match(api, /functionFormRequest\('meal-photo', form\)/)
  assert.doesNotMatch(api.match(/async function uploadStudentMealPhoto[\s\S]*?\n}/)?.[0] || '', /storage\/v1\/object\/|x-upsert/i)
})

test('migração aplica RLS, acesso por convite e inclui fotos na exclusão de conta', () => {
  assert.match(migration, /create table if not exists public\.student_meal_logs/i)
  assert.match(migration, /nutrition_plan_id uuid references public\.nutrition_plans/i)
  assert.match(migration, /alter table public\.student_meal_logs enable row level security/i)
  assert.match(migration, /values \(\s*'meal-photos',[\s\S]{0,100}false,[\s\S]{0,50}10485760/i)
  assert.match(migration, /drop policy if exists student_meal_photos_select_own on storage\.objects/i)
  assert.match(migration, /public\.coachfit_student_financial_access_by_invite\(invite_code\)/i)
  assert.match(migration, /create or replace function public\.coachfit_account_storage_references\(\)/i)
  assert.match(migration, /select 'meal-photos'::text, meal_logs\.photo_path::text/i)
  assert.doesNotMatch(migration, /create policy[\s\S]*?using \(true\)/i)
  assert.match(api, /action: 'cleanup-student', studentId/)
})
