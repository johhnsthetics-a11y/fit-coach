import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  getFirstName,
  getLocalGreeting,
  shouldLoadStudentPremiumData,
} from '../src/studentAccess.js'

test('portal pendente nao solicita dados premium protegidos', () => {
  assert.equal(shouldLoadStudentPremiumData({ financial_access_open: false }), false)
  assert.equal(shouldLoadStudentPremiumData({ financial_access_open: true }), true)
  assert.equal(shouldLoadStudentPremiumData(null), false)
})

test('saudacao usa primeiro nome e horario local', () => {
  assert.equal(getFirstName('  Carlos Eduardo Silva '), 'Carlos')
  assert.equal(getLocalGreeting(new Date(2026, 8, 21, 8, 0)), 'Bom dia')
  assert.equal(getLocalGreeting(new Date(2026, 8, 21, 15, 0)), 'Boa tarde')
  assert.equal(getLocalGreeting(new Date(2026, 8, 21, 21, 0)), 'Boa noite')
})

test('migration cria uma unica referencia de avatar e bucket sem escrita publica', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260921_student_profile_identity.sql', import.meta.url), 'utf8')
  assert.match(sql, /add column if not exists avatar_path text/i)
  assert.match(sql, /profile-avatars/i)
  assert.match(sql, /file_size_limit[^;]*3145728/is)
  assert.match(sql, /'profile-avatars',[\s\S]*false,[\s\S]*3145728/i)
  assert.doesNotMatch(sql, /create policy[\s\S]*profile-avatars[\s\S]*for insert[\s\S]*to anon/i)
})

test('cabecalho permite trocar a propria foto clicando no avatar', async () => {
  const header = await readFile(new URL('../src/WelcomeHeader.jsx', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(header, /onAvatarClick/)
  assert.match(header, /aria-label=\{avatarLabel/)
  assert.match(header, /type="button"/)
  assert.match(app, /uploadRemoteProfessionalAvatar/)
  assert.match(app, /professionalAvatarInputRef/)
  assert.match(app, /onAvatarClick=\{\(\) => avatarInputRef\.current\?\.click\(\)\}/)
})

test('foto profissional usa storage privado e fica disponivel ao portal', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260923_profile_header_avatar.sql', import.meta.url), 'utf8')
  const source = await readFile(new URL('../supabase/functions/student-avatar/index.ts', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  assert.match(sql, /coach_settings[\s\S]*profile_avatar_path text/i)
  assert.match(sql, /coachfit_account_storage_references/i)
  assert.match(source, /professional-upload/)
  assert.match(source, /admin\.auth\.getUser\(token\)/)
  assert.match(source, /professionalAvatarUrl/)
  assert.match(api, /uploadRemoteProfessionalAvatar/)
  assert.match(api, /profilePhotoUrl:\s*professionalAvatarUrl/)
})

test('edge function valida convite e vinculo antes de trocar avatar', async () => {
  const source = await readFile(new URL('../supabase/functions/student-avatar/index.ts', import.meta.url), 'utf8')
  assert.match(source, /student_invites/)
  assert.match(source, /status[^\n]*active/i)
  assert.match(source, /expires_at/i)
  assert.match(source, /student\.coach_id[^\n]*invite\.coach_id/i)
  assert.match(source, /avatar_path/)
  assert.match(source, /allowedMimeTypes/)
  assert.match(source, /3 \* 1024 \* 1024/)
})

test('frontend evita RPC premium no acesso pendente e oferece edicao da foto', async () => {
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(api, /shouldLoadStudentPremiumData\(payload\)/)
  assert.match(api, /uploadRemoteStudentAvatar/)
  assert.match(api, /student-avatar/)
  assert.match(app, /getLocalGreeting/)
  assert.match(app, /Selecionar foto de perfil/)
  assert.match(app, /Acompanhado por/)
})

test('portal entrega somente o nome e tipo do profissional associado', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260921_student_professional_identity.sql', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  assert.match(sql, /professional_name/i)
  assert.match(sql, /join public\.users as users on users\.id = invites\.coach_id/i)
  assert.doesNotMatch(sql, /users\.email/i)
  assert.match(api, /professionalName:\s*payload\.professional_name/)
})

