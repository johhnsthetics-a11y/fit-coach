const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const lowercase = 'abcdefghjkmnpqrstuvwxyz'
const digits = '23456789'
const symbols = '!@#$%*-_'
const allCharacters = `${uppercase}${lowercase}${digits}${symbols}`

export function normalizeCredentialEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Informe um e-mail válido para gerar o acesso.')
  }
  return email
}

export function canRegenerateTemporaryPassword(student) {
  return Boolean(student?.auth_user_id && student?.must_change_password === true)
}

export function buildTemporaryPassword(randomBytes) {
  const bytes = randomBytes instanceof Uint8Array ? randomBytes : new Uint8Array()
  if (bytes.length < 20) throw new Error('Não foi possível gerar uma senha segura.')

  const characters = [
    uppercase[bytes[0] % uppercase.length],
    lowercase[bytes[1] % lowercase.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ]
  for (let index = 4; index < 16; index += 1) {
    characters.push(allCharacters[bytes[index] % allCharacters.length])
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = bytes[16 + (index % (bytes.length - 16))] % (index + 1)
    ;[characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]]
  }
  return characters.join('')
}
