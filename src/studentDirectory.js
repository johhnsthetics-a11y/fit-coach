export function normalizeStudentSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function filterStudents(students = [], query = '') {
  const source = Array.isArray(students) ? students : []
  const normalizedQuery = normalizeStudentSearch(query)
  if (!normalizedQuery) return source.slice()

  const queryDigits = normalizedQuery.replace(/\D/g, '')

  return source.filter((student) => {
    const searchableText = normalizeStudentSearch([
      student?.name,
      student?.email,
      student?.cpf,
    ].filter(Boolean).join(' '))
    const cpfDigits = String(student?.cpf || '').replace(/\D/g, '')

    return searchableText.includes(normalizedQuery)
      || Boolean(queryDigits && cpfDigits.includes(queryDigits))
  })
}
