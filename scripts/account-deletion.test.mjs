import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

import {
  collectStorageObjects,
  normalizeEmail,
} from '../supabase/functions/delete-coach-account/accountDeletionModel.mjs'

test('normaliza o e-mail confirmado sem aceitar valores vazios', () => {
  assert.equal(normalizeEmail('  Pessoa@Exemplo.COM '), 'pessoa@exemplo.com')
  assert.equal(normalizeEmail(null), '')
})

test('coleta somente objetos válidos dos buckets do projeto', () => {
  const objects = collectStorageObjects([
    { bucket_id: 'checkin-photos', storage_value: 'https://demo.supabase.co/storage/v1/object/public/checkin-photos/coach/checkin.jpg' },
    { bucket_id: 'message-attachments', storage_value: 'coach/audio.webm' },
    { bucket_id: 'workout-videos', storage_value: 'https://www.youtube.com/watch?v=publico' },
    { bucket_id: 'checkin-photos', storage_value: 'https://demo.supabase.co/storage/v1/object/public/checkin-photos/coach/checkin.jpg' },
  ])

  assert.deepEqual(objects, [
    { bucket: 'checkin-photos', path: 'coach/checkin.jpg' },
    { bucket: 'message-attachments', path: 'coach/audio.webm' },
  ])
})

test('Edge Function autentica, limpa arquivos e remove a conta no servidor', async () => {
  const source = await readFile(new URL('../supabase/functions/delete-coach-account/index.ts', import.meta.url), 'utf8')

  assert.match(source, /auth\.getUser\(token\)/)
  assert.match(source, /admin_users/)
  assert.match(source, /storage\.from\(bucket\)\.remove/)
  assert.match(source, /auth\.admin\.deleteUser\(user\.id\)/)
  assert.doesNotMatch(source, /status\s*=\s*501|},\s*501\)/)
})

test('migração conecta a exclusão autenticada aos dados do aplicativo', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260921_secure_account_deletion.sql', import.meta.url), 'utf8')

  assert.match(source, /create or replace function public\.coachfit_account_storage_references/i)
  assert.match(source, /owner_id::text\s*=\s*auth\.uid\(\)::text/i)
  assert.match(source, /create trigger coachfit_delete_public_user/i)
  assert.match(source, /delete from public\.users where id = old\.id/i)
  assert.match(source, /grant execute on function public\.coachfit_account_storage_references\(\) to authenticated/i)
})
