import assert from 'node:assert/strict'
import test from 'node:test'

import { establishStudentPersonalPassword } from '../src/studentFirstPassword.js'

test('first access confirms the personal password with a fresh login before activation', async () => {
  const events = []
  const verifiedSession = {
    access_token: 'fresh-access-token',
    refresh_token: 'fresh-refresh-token',
    user: { id: 'student-auth-id', email: 'aluno@example.com' },
  }

  const result = await establishStudentPersonalPassword({
    password: 'SenhaNova#2026',
    currentEmail: 'cadastro-antigo@example.com',
    updateAuthenticatedPassword: async (password) => {
      events.push(['password-updated', password])
      return { email: ' Aluno@Example.com ' }
    },
    signInWithPassword: async ({ email, password }) => {
      events.push(['password-verified', email, password])
      return verifiedSession
    },
    finalizeFirstAccess: async (session) => {
      events.push(['access-finalized', session.access_token])
    },
  })

  assert.equal(result, verifiedSession)
  assert.deepEqual(events, [
    ['password-updated', 'SenhaNova#2026'],
    ['password-verified', 'aluno@example.com', 'SenhaNova#2026'],
    ['access-finalized', 'fresh-access-token'],
  ])
})

test('first access never marks activation complete when the new password cannot create a fresh session', async () => {
  let finalized = false

  await assert.rejects(
    establishStudentPersonalPassword({
      password: 'SenhaNova#2026',
      currentEmail: 'aluno@example.com',
      updateAuthenticatedPassword: async () => ({ email: 'aluno@example.com' }),
      signInWithPassword: async () => ({ access_token: '', refresh_token: '' }),
      finalizeFirstAccess: async () => {
        finalized = true
      },
    }),
    /validar a nova senha/i,
  )

  assert.equal(finalized, false)
})
