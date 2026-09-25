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
