export async function establishStudentPersonalPassword({
  password,
  currentEmail = '',
  updateAuthenticatedPassword,
  signInWithPassword,
  finalizeFirstAccess,
}) {
  const nextPassword = String(password || '')
  if (nextPassword.length < 8) {
    throw new Error('A nova senha deve ter pelo menos 8 caracteres.')
  }

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
