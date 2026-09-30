import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const helperUrl = new URL('../supabase/functions/student-credentials/credentialPolicy.mjs', import.meta.url)
const functionUrl = new URL('../supabase/functions/student-credentials/index.ts', import.meta.url)

let helperExists = true
try {
  await access(helperUrl)
} catch {
  helperExists = false
}

test('credential policy module exists', () => {
  assert.equal(helperExists, true)
})

if (helperExists) {
  const {
    buildTemporaryPassword,
    canRegenerateTemporaryPassword,
    normalizeCredentialEmail,
  } = await import(helperUrl)

  test('normalizes a valid client email and rejects invalid input', () => {
    assert.equal(normalizeCredentialEmail('  Aluno@Example.COM '), 'aluno@example.com')
    assert.throws(() => normalizeCredentialEmail('sem-email'), /e-mail válido/i)
  })

  test('builds a readable strong temporary password from secure bytes', () => {
    const password = buildTemporaryPassword(Uint8Array.from({ length: 32 }, (_, index) => index))
    assert.ok(password.length >= 14)
    assert.match(password, /[A-Z]/)
    assert.match(password, /[a-z]/)
    assert.match(password, /[0-9]/)
    assert.match(password, /[^A-Za-z0-9]/)
    assert.doesNotMatch(password, /[0OIl1]/)
  })

  test('allows credential regeneration only before personal password setup', () => {
    assert.equal(canRegenerateTemporaryPassword({ auth_user_id: 'user-id', must_change_password: true }), true)
    assert.equal(canRegenerateTemporaryPassword({ auth_user_id: 'user-id', must_change_password: false }), false)
    assert.equal(canRegenerateTemporaryPassword({ auth_user_id: null, must_change_password: false }), false)
  })
}

test('edge function enforces owner lookup, authenticated user and compensation cleanup', async () => {
  const source = await readFile(functionUrl, 'utf8').catch(() => '')

  assert.match(source, /admin\.auth\.getUser\(token\)/)
  assert.match(source, /\.eq\('coach_id',\s*caller\.id\)/)
  assert.match(source, /\.eq\('id',\s*studentId\)/)
  assert.match(source, /admin\.auth\.admin\.createUser/)
  assert.match(source, /admin\.auth\.admin\.updateUserById/)
  assert.match(source, /admin\.auth\.admin\.deleteUser/)
  assert.match(source, /account_type:\s*'student'/)
  assert.match(source, /temporaryPassword/)
  assert.doesNotMatch(source, /console\.log\([^\n]*(password|token)/i)
})
