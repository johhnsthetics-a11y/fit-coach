import { getNewPasswordError } from './passwordPolicy.js'

export async function establishStudentPersonalPassword({
  password,
  currentEmail = '',
  updateAuthenticatedPassword,
  signInWithPassword,
  finalizeFirstAccess,
}) {
  const nextPassword = String(password || '')
  const passwordError = getNewPasswordError(nextPassword)
  if (passwordError) throw new Error(passwordError)

  const updatedAccount = await updateAuthenticatedPassword(nextPassword)
  const email = String(updatedAccount?.email || currentEmail || '').trim().toLowerCase()
  if (!email) {
    throw new Error('Não foi possível identificar o e-mail desta conta.')
  }

  const session = await signInWithPassword({ email, password: nextPassword })
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error('Não foi possível validar a nova senha. Tente novamente.')
  }

  await finalizeFirstAccess(session)
  return session
}

function isStudentSession(session) {
  const accountType = session?.user?.accountType
    || session?.user?.appMetadata?.account_type
    || session?.user?.app_metadata?.account_type
    || ''
  return String(accountType).toLowerCase() === 'student'
}

export function requireStudentBootstrapForSession(session, studentBootstrap) {
  if (isStudentSession(session) && !studentBootstrap) {
    throw new Error('Este login de aluno ou paciente ainda não está vinculado a um acesso ativo. Tente novamente em instantes.')
  }
  return studentBootstrap || null
}

export async function loadStudentPortalWithRetry({
  loadStudentAccess,
  loadStudentPortal,
  onFirstAccess,
  attempts = 3,
  retryDelayMs = 350,
}) {
  let lastError = null

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      const access = await loadStudentAccess()
      if (!access?.inviteCode) throw new Error('Acesso do aluno ou paciente ainda indisponível.')
      if (access.mustChangePassword) {
        if (onFirstAccess) {
          onFirstAccess(access)
          return null
        }
        throw new Error('A ativação da senha ainda não foi concluída.')
      }

      const portal = await loadStudentPortal(access.inviteCode)
      if (!portal?.student) throw new Error('Dados do portal ainda indisponíveis.')
      return portal
    } catch (error) {
      lastError = error
      if (attempt < Math.max(1, attempts) && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
    }
  }

  const error = new Error('Sua senha está válida, mas não foi possível carregar o acesso do aluno ou paciente. Tente novamente.')
  error.cause = lastError
  throw error
}
