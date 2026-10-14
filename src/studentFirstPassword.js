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
