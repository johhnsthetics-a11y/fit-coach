import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  PASSWORD_POLICY_HINT,
  getNewPasswordError,
  validateNewPasswordConfirmation,
} from '../src/passwordPolicy.js'

test('politica aceita senha longa com letras, numero e simbolo', () => {
  assert.equal(getNewPasswordError('SenhaNova#2026'), '')
  assert.match(PASSWORD_POLICY_HINT, /10 caracteres/i)
})

test('politica recusa senhas curtas, comuns ou sem variedade', () => {
  assert.match(getNewPasswordError('Aa1#abcd'), /10 caracteres/i)
  assert.match(getNewPasswordError('senhanova2026'), /maiúscula.*símbolo/i)
  assert.match(getNewPasswordError('Senha123456!'), /muito comum/i)
})

test('confirmacao valida a politica antes de comparar os campos', () => {
  assert.match(validateNewPasswordConfirmation('curta', 'curta'), /10 caracteres/i)
  assert.match(validateNewPasswordConfirmation('SenhaNova#2026', 'OutraSenha#2026'), /não coincidem/i)
  assert.equal(validateNewPasswordConfirmation('SenhaNova#2026', 'SenhaNova#2026'), '')
})

test('cadastro, primeiro acesso e recuperacao reutilizam a mesma politica', async () => {
  const [app, recovery, firstPassword] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/PasswordRecoveryFlow.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/studentFirstPassword.js', import.meta.url), 'utf8'),
  ])

  assert.match(app, /validateNewPasswordConfirmation/)
  assert.match(app, /getNewPasswordError\(password\)/)
  assert.match(recovery, /validateNewPasswordConfirmation/)
  assert.match(firstPassword, /getNewPasswordError\(nextPassword\)/)
  assert.doesNotMatch(app, /password\.length < (6|8)/)
  assert.doesNotMatch(recovery, /newPassword\.length < 8/)
})
