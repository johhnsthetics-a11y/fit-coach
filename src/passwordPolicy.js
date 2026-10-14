export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_POLICY_HINT = 'Use pelo menos 10 caracteres, com letra maiúscula, minúscula, número e símbolo.'

const COMMON_PASSWORDS = new Set([
  'password123!',
  'senha123456!',
  'senha@12345',
  'admin123456!',
  'coachfit123!',
])

export function getNewPasswordError(password) {
  const value = String(password || '')
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }

  const missing = []
  if (!/[a-z]/.test(value)) missing.push('uma letra minúscula')
  if (!/[A-Z]/.test(value)) missing.push('uma letra maiúscula')
  if (!/[0-9]/.test(value)) missing.push('um número')
  if (!/[^A-Za-z0-9]/.test(value)) missing.push('um símbolo')
  if (missing.length) return `Inclua ${missing.join(', ')}.`

  if (COMMON_PASSWORDS.has(value.trim().toLowerCase())) {
    return 'Essa senha é muito comum. Escolha uma combinação diferente.'
  }

  return ''
}

export function validateNewPasswordConfirmation(password, confirmation) {
  const policyError = getNewPasswordError(password)
  if (policyError) return policyError
  if (password !== confirmation) return 'As senhas não coincidem.'
  return ''
}
