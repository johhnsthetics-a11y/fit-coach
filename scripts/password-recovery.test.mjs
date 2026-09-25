import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('recuperacao de senha fica disponivel no login e usa mensagem neutra', async () => {
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  const flow = await readFile(new URL('../src/PasswordRecoveryFlow.jsx', import.meta.url), 'utf8')

  assert.match(main, /PasswordRecoveryFlow/)
  assert.match(flow, /Esqueci minha senha/)
  assert.match(flow, /Se existir uma conta vinculada a este e-mail/)
  assert.match(flow, /Informe um e-mail válido/)
  assert.match(flow, /mode === 'forgot-password'/)
})

test('email de recuperacao retorna para modo recovery no dominio atual', async () => {
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(api, /new URL\('\/login', window\.location\.origin\)/)
  assert.match(api, /searchParams\.set\('mode', 'recovery'\)/)
  assert.match(api, /recover\?redirect_to=/)
})

test('retorno de recuperacao remove token da URL e exige senha forte confirmada', async () => {
  const flow = await readFile(new URL('../src/PasswordRecoveryFlow.jsx', import.meta.url), 'utf8')

  assert.match(flow, /hashType === 'recovery'/)
  assert.match(flow, /cleanUrl\.hash = ''/)
  assert.match(flow, /newPassword\.length < 8/)
  assert.match(flow, /newPassword !== confirmPassword/)
  assert.match(flow, /updateRecoveredPassword\(recoveryToken, newPassword\)/)
  assert.match(flow, /Senha alterada com sucesso/)
})


test('recuperacao usa uma unica tela e nao deixa o app renderizado por baixo', async () => {
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  const flow = await readFile(new URL('../src/PasswordRecoveryFlow.jsx', import.meta.url), 'utf8')

  assert.match(main, /const \[recoveryOnly, setRecoveryOnly\]/)
  assert.match(main, /recoveryOnly\s*\?\s*<PasswordRecoveryFlow \/>/)
  assert.match(flow, /export function isPasswordRecoveryRoute/)
  assert.match(flow, /mode === 'forgot-password'/)
  assert.match(flow, /mode === 'recovery'/)
})

test('campos de nova senha possuem controle visual de mostrar e ocultar', async () => {
  const flow = await readFile(new URL('../src/PasswordRecoveryFlow.jsx', import.meta.url), 'utf8')

  assert.match(flow, /allowVisibilityToggle/)
  assert.match(flow, /aria-label=\{visible \? 'Ocultar senha' : 'Mostrar senha'\}/)
  assert.match(flow, /effectiveType = allowVisibilityToggle \? \(visible \? 'text' : 'password'\)/)
  assert.match(flow, /<EyeIcon hidden=\{!visible\} \/>/)
})


test('tela final usa identidade real e nao exibe texto de prototipo', async () => {
  const flow = await readFile(new URL('../src/PasswordRecoveryFlow.jsx', import.meta.url), 'utf8')

  assert.match(flow, /fitCoachLogo/)
  assert.doesNotMatch(flow, />\s*CF\s*</)
  assert.doesNotMatch(flow, /Use os ícones de olho para conferir o que digitou antes de salvar\./)
  assert.match(flow, /description="Crie uma nova senha para acessar sua conta\."/)
})

test('sucesso da troca de senha exige validacao de login com a nova senha', async () => {
  const flow = await readFile(new URL('../src/PasswordRecoveryFlow.jsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(flow, /const updatedAccount = await updateRecoveredPassword\(recoveryToken, newPassword\)/)
  assert.match(flow, /await verifyRecoveredPasswordChange\(updatedAccount\.email, newPassword\)/)
  assert.match(api, /export async function verifyRecoveredPasswordChange\(email, password\)/)
  assert.match(api, /token\?grant_type=password/)
  assert.match(api, /await signOutCoach\(payload\.access_token\)\.catch/)
  assert.match(api, /return \{ email \}/)
})
