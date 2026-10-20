import assert from 'node:assert/strict'
import test from 'node:test'

import * as studentPasswordFlow from '../src/studentFirstPassword.js'

const { establishStudentPersonalPassword } = studentPasswordFlow

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

test('student sessions never fall through to a professional workspace when bootstrap is unavailable', () => {
  assert.equal(typeof studentPasswordFlow.requireStudentBootstrapForSession, 'function')

  const studentSession = {
    user: {
      id: 'student-auth-id',
      appMetadata: { account_type: 'student' },
    },
  }

  assert.throws(
    () => studentPasswordFlow.requireStudentBootstrapForSession(studentSession, null),
    /aluno ou paciente/i,
  )
  assert.equal(
    studentPasswordFlow.requireStudentBootstrapForSession({ user: { id: 'coach-id' } }, null),
    null,
  )
})

test('portal hydration retries after a transient read failure without asking for another password change', async () => {
  assert.equal(typeof studentPasswordFlow.loadStudentPortalWithRetry, 'function')
  let accessAttempts = 0
  let portalAttempts = 0

  const portal = await studentPasswordFlow.loadStudentPortalWithRetry({
    attempts: 3,
    retryDelayMs: 0,
    loadStudentAccess: async () => {
      accessAttempts += 1
      if (accessAttempts === 1) throw new Error('temporary network error')
      return { inviteCode: 'PATIENT-123', mustChangePassword: false }
    },
    loadStudentPortal: async (inviteCode) => {
      portalAttempts += 1
      assert.equal(inviteCode, 'PATIENT-123')
      return { student: { id: 'patient-id' } }
    },
  })

  assert.deepEqual(portal, { student: { id: 'patient-id' } })
  assert.equal(accessAttempts, 2)
  assert.equal(portalAttempts, 1)
})
