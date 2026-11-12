function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function digits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function filterProfessionalTeamCandidates(candidates, query) {
  const list = Array.isArray(candidates) ? candidates : []
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return list
  const queryDigits = digits(normalizedQuery)
  return list.filter((candidate) => {
    const name = normalizeText(candidate?.name ?? candidate?.fullName ?? candidate?.full_name)
    const email = normalizeText(candidate?.email)
    const cpf = digits(candidate?.cpf ?? candidate?.document)
    return name.includes(normalizedQuery)
      || email.includes(normalizedQuery)
      || (queryDigits.length > 0 && cpf.includes(queryDigits))
  })
}
