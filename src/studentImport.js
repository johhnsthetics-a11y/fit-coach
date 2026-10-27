const HEADER_ALIASES = {
  name: ['nome', 'name', 'nome completo', 'full name', 'aluno', 'student', 'paciente', 'patient', 'cliente', 'client'],
  email: ['email', 'e-mail', 'correio eletronico', 'mail'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'mobile'],
  cpf: ['cpf', 'documento', 'document', 'documento cpf'],
  goal: ['objetivo', 'goal', 'meta', 'objetivo principal'],
  plan: ['plano', 'plan', 'assinatura', 'subscription', 'servico', 'serviço'],
}

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase()
}

function normalizeCpf(value = '') {
  return String(value).replace(/\D/g, '')
}

function detectDelimiter(text = '') {
  const firstLine = String(text).replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || ''
  const candidates = [',', ';', '\t']
  const counts = new Map(candidates.map((candidate) => [candidate, 0]))
  let inQuotes = false

  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index]
    if (character === '"') {
      if (inQuotes && firstLine[index + 1] === '"') index += 1
      else inQuotes = !inQuotes
    } else if (!inQuotes && counts.has(character)) {
      counts.set(character, counts.get(character) + 1)
    }
  }

  return candidates.reduce((best, candidate) => (
    counts.get(candidate) > counts.get(best) ? candidate : best
  ), ',')
}

function parseDelimitedRows(text, delimiter) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  let values = []
  let field = ''
  let inQuotes = false
  let lineNumber = 1
  let rowLineNumber = 1

  const completeRow = () => {
    values.push(field.trim())
    if (values.some((value) => value !== '')) {
      rows.push({ values, lineNumber: rowLineNumber })
    }
    values = []
    field = ''
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '"') {
      if (inQuotes && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && character === delimiter) {
      values.push(field.trim())
      field = ''
      continue
    }

    if (character === '\r' || character === '\n') {
      const isCrLf = character === '\r' && source[index + 1] === '\n'
      if (inQuotes) {
        field += '\n'
      } else {
        completeRow()
        rowLineNumber = lineNumber + 1
      }
      if (isCrLf) index += 1
      lineNumber += 1
      continue
    }

    field += character
  }

  if (field !== '' || values.length > 0) completeRow()
  return rows
}

export function parseStudentImportText(text = '') {
  const delimiter = detectDelimiter(text)
  const rows = parseDelimitedRows(text, delimiter)
  const [headerRow, ...records] = rows

  return {
    delimiter,
    headers: headerRow?.values ?? [],
    records,
  }
}

function resolveColumns(headers = []) {
  const aliasEntries = Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) => (
    aliases.map((alias) => [normalizeText(alias), field])
  ))
  const aliasMap = new Map(aliasEntries)

  return headers.reduce((columns, header, index) => {
    const field = aliasMap.get(normalizeText(header))
    if (field && columns[field] === undefined) columns[field] = index
    return columns
  }, {})
}

function getValue(values, index) {
  return index === undefined ? '' : String(values[index] ?? '').trim()
}

function getStudentIdentity(student = {}) {
  return {
    email: normalizeEmail(student.email),
    cpf: normalizeCpf(student.cpf),
  }
}

export function findStudentImportDuplicate(student, existingStudents = []) {
  const identity = getStudentIdentity(student)
  return existingStudents.find((existingStudent) => {
    const existingIdentity = getStudentIdentity(existingStudent)
    return Boolean(
      (identity.email && existingIdentity.email === identity.email)
      || (identity.cpf && existingIdentity.cpf === identity.cpf),
    )
  }) || null
}

function resolvePlan(planName, plans = [], defaultPlanName = '') {
  const fallback = plans.find((plan) => normalizeText(plan.name) === normalizeText(defaultPlanName))
    || plans[0]
    || { name: defaultPlanName || 'Acompanhamento mensal', cycle: 'mensal' }
  const requested = planName
    ? plans.find((plan) => normalizeText(plan.name) === normalizeText(planName))
    : null
  const selected = requested || fallback
  const cycle = ['semanal', 'mensal', 'semestral', 'anual'].includes(selected?.cycle)
    ? selected.cycle
    : 'mensal'

  return {
    name: selected?.name || 'Acompanhamento mensal',
    cycle,
    warning: planName && !requested
      ? `O plano "${planName}" nao existe nesta conta; sera usado "${selected?.name || 'Acompanhamento mensal'}".`
      : '',
  }
}

function buildStudent(values, columns, plan) {
  return {
    name: getValue(values, columns.name),
    email: normalizeEmail(getValue(values, columns.email)),
    phone: getValue(values, columns.phone),
    cpf: normalizeCpf(getValue(values, columns.cpf)),
    goal: getValue(values, columns.goal),
    phase: 'Importado',
    status: 'Aguardando convite',
    plan: plan.name,
    payment: 'Pendente',
    appPaymentStatus: 'pending',
    billingCycle: plan.cycle,
    firstDueDate: '',
    nextDueDate: '',
    adherence: 0,
    risk: 'Baixo',
    nextCheckin: '',
    weight: '',
    bodyFat: '',
    calories: '',
    protein: '',
    workout: '',
    lastMessage: 'Cadastro importado. Acesso aguardando liberacao pelo profissional.',
    requireAnamnesis: true,
    accessOverrideUntil: '',
    loadNotes: '',
    waterGoalMl: '2500',
  }
}

function validateStudent(student, rawCpf = student.cpf) {
  const errors = []
  if (!student.name.trim()) errors.push('Informe o nome.')
  if (!student.email) errors.push('Informe o e-mail.')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) errors.push('Informe um e-mail valido.')
  const cpf = normalizeCpf(student.cpf)
  if (rawCpf && !/^[\d.\-\s]+$/.test(rawCpf)) errors.push('O CPF possui caracteres invalidos.')
  if (cpf && cpf.length !== 11) errors.push('O CPF deve ter 11 numeros.')
  return errors
}

export function prepareStudentImportRows({
  text = '',
  existingStudents = [],
  plans = [],
  defaultPlanName = '',
} = {}) {
  const parsed = parseStudentImportText(text)
  const columns = resolveColumns(parsed.headers)
  const missingColumns = ['name', 'email'].filter((field) => columns[field] === undefined)
  const seenStudents = [...existingStudents]

  const rows = parsed.records.map((record) => {
    if (missingColumns.length) {
      return {
        lineNumber: record.lineNumber,
        status: 'invalid',
        student: {},
        errors: [`A planilha precisa das colunas ${missingColumns.map((field) => field === 'name' ? 'nome' : 'email').join(' e ')}.`],
        warnings: [],
      }
    }

    const requestedPlan = getValue(record.values, columns.plan)
    const plan = resolvePlan(requestedPlan, plans, defaultPlanName)
    const rawCpf = getValue(record.values, columns.cpf)
    const student = buildStudent(record.values, columns, plan)
    const validationErrors = validateStudent(student, rawCpf)
    const duplicate = findStudentImportDuplicate(student, seenStudents)
    const duplicateReasons = []
    if (duplicate) {
      const identity = getStudentIdentity(student)
      const duplicateIdentity = getStudentIdentity(duplicate)
      if (identity.email && identity.email === duplicateIdentity.email) duplicateReasons.push('E-mail duplicado.')
      if (identity.cpf && identity.cpf === duplicateIdentity.cpf) duplicateReasons.push('CPF duplicado.')
    }

    const status = duplicate ? 'duplicate' : validationErrors.length ? 'invalid' : 'ready'
    if (status === 'ready') seenStudents.push(student)

    return {
      lineNumber: record.lineNumber,
      status,
      student,
      errors: duplicateReasons.length ? duplicateReasons : validationErrors,
      warnings: plan.warning ? [plan.warning] : [],
    }
  })

  return {
    ...parsed,
    columns,
    rows,
    counts: {
      total: rows.length,
      ready: rows.filter((row) => row.status === 'ready').length,
      duplicate: rows.filter((row) => row.status === 'duplicate').length,
      invalid: rows.filter((row) => row.status === 'invalid').length,
    },
  }
}

export function buildStudentImportTemplate() {
  return [
    'nome,email,telefone,cpf,objetivo,plano',
    'Maria Silva,maria@example.com,11999990000,12345678901,Condicionamento,Acompanhamento mensal',
  ].join('\r\n')
}
