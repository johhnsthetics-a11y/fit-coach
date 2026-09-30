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

test('frontend adapters use authenticated contracts without persisting credentials', async () => {
  const source = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

  assert.match(source, /export async function generateRemoteStudentCredentials\(studentId\)/)
  assert.match(source, /if \(!isUuid\(studentId\)\)/)
  assert.match(source, /functionRequest\('student-credentials',\s*\{\s*action:\s*'generate',\s*studentId\s*\}\)/s)
  assert.match(source, /export async function loadRemoteCurrentStudentAccess\(\)/)
  assert.match(source, /rpcRequest\('get_current_student_access',\s*\{\}\)/)
  assert.match(source, /inviteCode:\s*row\.invite_code/)
  assert.match(source, /professionalType:\s*row\.professional_type/)
  assert.match(source, /export async function completeRemoteStudentFirstPassword\(password\)/)
  assert.match(source, /password\.length\s*<\s*8/)
  assert.match(source, /action:\s*'complete-first-password'/)
  assert.doesNotMatch(source, /localStorage[^\n]*(temporaryPassword|password)/i)
})

test('student row maps authentication state without password fields', async () => {
  const source = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  assert.match(source, /authUserId:\s*row\.auth_user_id/)
  assert.match(source, /mustChangePassword:\s*row\.must_change_password/)
  assert.match(source, /credentialsGeneratedAt:\s*row\.credentials_generated_at/)
  assert.doesNotMatch(source, /temporaryPassword:\s*row\./)
})

test('professional can generate and share one-time login credentials', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /generateRemoteStudentCredentials/)
  assert.match(source, /Gerar dados de acesso/)
  assert.match(source, /Copiar acesso/)
  assert.match(source, /wa\.me\/\?text=/)
  assert.match(source, /Enviar pelo WhatsApp/)
  assert.match(source, /setGeneratedCredentials\(null\)/)
  assert.match(source, /selectedStudent\?\.email/)
  assert.match(source, /mustChangePassword/)
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(temporaryPassword|generatedCredentials)/i)
})

test('credential sharing copy adapts to student and patient', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /nutritionist \? 'paciente' : 'aluno'/)
  assert.match(source, /Senha temporária/)
  assert.match(source, /troque sua senha/i)
})

test('authenticated student login routes before professional workspace hydration', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  assert.match(api, /accountType:\s*appMetadata\.account_type/)
  assert.match(app, /loadRemoteCurrentStudentAccess/)
  assert.match(app, /data\.session\?\.user\?\.accountType === 'student'/)
  assert.match(app, /if \(studentBootstrap\)/)
  assert.match(app, /studentBootstrap\.mustChangePassword/)
  assert.match(app, /loadRemoteStudentByInvite\(studentBootstrap\.inviteCode\)/)
  assert.match(app, /if \(data\.session\?\.user\?\.accountType === 'student'\) return/)
})

test('first student login requires matching personal password before portal', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /function StudentFirstPasswordScreen/)
  assert.match(app, /completeRemoteStudentFirstPassword/)
  assert.match(app, /password\.length < 8/)
  assert.match(app, /password !== confirmation/)
  assert.match(app, /Criar minha senha/)
  assert.match(app, /setStudentFirstAccess\(null\)/)
})

test('authenticated student keeps existing server-side payment lock and clears session on exit', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /resolveStudentPaymentLockState/)
  assert.match(app, /financialAccessOpen/)
  assert.match(app, /if \(studentAuthSession\) \{\s*logout\(\)/s)
  assert.match(app, /setStudentFirstAccess\(null\)/)
})
