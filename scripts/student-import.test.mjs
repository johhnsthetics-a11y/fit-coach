import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildStudentImportTemplate,
  parseStudentImportText,
  prepareStudentImportRows,
} from '../src/studentImport.js'

test('interpreta CSV com BOM, CRLF, virgulas e aspas escapadas', () => {
  const parsed = parseStudentImportText('\uFEFFNome,E-mail,Telefone,CPF,Objetivo,Plano\r\n"Maria, Silva",maria@example.com,"(11) 99999-0000",123.456.789-00,"Perder ""5 kg""",Premium\r\n')

  assert.equal(parsed.delimiter, ',')
  assert.deepEqual(parsed.headers, ['Nome', 'E-mail', 'Telefone', 'CPF', 'Objetivo', 'Plano'])
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.records[0].values[0], 'Maria, Silva')
  assert.equal(parsed.records[0].values[4], 'Perder "5 kg"')
  assert.equal(parsed.records[0].lineNumber, 2)
})

test('aceita ponto e virgula e texto tabulado com aliases comuns', () => {
  const semicolon = prepareStudentImportRows({
    text: 'cliente;e-mail;whatsapp;documento;meta;assinatura\nAna Souza;ana@example.com;11999990000;12345678901;Hipertrofia;Mensal',
    existingStudents: [],
    plans: [{ name: 'Mensal', cycle: 'mensal' }],
    defaultPlanName: 'Mensal',
  })
  assert.equal(semicolon.rows[0].status, 'ready')
  assert.partialDeepStrictEqual(semicolon.rows[0].student, {
    name: 'Ana Souza',
    email: 'ana@example.com',
    phone: '11999990000',
    cpf: '12345678901',
    goal: 'Hipertrofia',
    plan: 'Mensal',
    billingCycle: 'mensal',
  })

  const tabbed = prepareStudentImportRows({
    text: 'patient\temail\tphone\tgoal\nCaio Lima\tcaio@example.com\t21988887777\tSaude',
    existingStudents: [],
    plans: [{ name: 'Padrao', cycle: 'mensal' }],
    defaultPlanName: 'Padrao',
  })
  assert.equal(tabbed.rows[0].status, 'ready')
  assert.equal(tabbed.rows[0].student.name, 'Caio Lima')
})

test('classifica duplicados da carteira e do proprio arquivo sem importar novamente', () => {
  const prepared = prepareStudentImportRows({
    text: [
      'nome,email,cpf',
      'Existente,ALUNO@EXAMPLE.COM,',
      'Nova Pessoa,nova@example.com,987.654.321-00',
      'Repetida no arquivo,repetida@example.com,98765432100',
    ].join('\n'),
    existingStudents: [{ name: 'Aluno atual', email: 'aluno@example.com', cpf: '' }],
    plans: [{ name: 'Mensal', cycle: 'mensal' }],
    defaultPlanName: 'Mensal',
  })

  assert.deepEqual(prepared.rows.map((row) => row.status), ['duplicate', 'ready', 'duplicate'])
  assert.match(prepared.rows[0].errors.join(' '), /e-mail/i)
  assert.match(prepared.rows[2].errors.join(' '), /CPF/i)
  assert.deepEqual(prepared.counts, { total: 3, ready: 1, duplicate: 2, invalid: 0 })
})

test('rejeita nome ou email ausente, email invalido e CPF incompleto', () => {
  const prepared = prepareStudentImportRows({
    text: [
      'nome,email,cpf',
      ',semnome@example.com,',
      'Sem email,,',
      'Email ruim,nao-e-email,',
      'CPF ruim,cpf@example.com,123',
    ].join('\n'),
    existingStudents: [],
    plans: [{ name: 'Mensal', cycle: 'mensal' }],
    defaultPlanName: 'Mensal',
  })

  assert.deepEqual(prepared.rows.map((row) => row.status), ['invalid', 'invalid', 'invalid', 'invalid'])
  assert.equal(prepared.counts.invalid, 4)
  assert.match(prepared.rows[0].errors.join(' '), /nome/i)
  assert.match(prepared.rows[1].errors.join(' '), /e-mail/i)
  assert.match(prepared.rows[3].errors.join(' '), /11 numeros/i)
})

test('rejeita CPF com letras e persiste CPF formatado somente com digitos', () => {
  const prepared = prepareStudentImportRows({
    text: [
      'nome,email,cpf',
      'CPF letras,letras@example.com,ABC12345678901XYZ',
      'CPF formatado,formatado@example.com,123.456.789-01',
    ].join('\n'),
    existingStudents: [],
    plans: [{ name: 'Mensal', cycle: 'mensal' }],
    defaultPlanName: 'Mensal',
  })

  assert.equal(prepared.rows[0].status, 'invalid')
  assert.match(prepared.rows[0].errors.join(' '), /CPF/i)
  assert.equal(prepared.rows[1].status, 'ready')
  assert.equal(prepared.rows[1].student.cpf, '12345678901')
})

test('aplica plano padrao e marca aviso quando o plano importado nao existe', () => {
  const prepared = prepareStudentImportRows({
    text: 'nome,email,plano\nMarina,marina@example.com,Plano da outra plataforma',
    existingStudents: [],
    plans: [{ name: 'Essencial', cycle: 'semestral' }],
    defaultPlanName: 'Essencial',
  })

  assert.equal(prepared.rows[0].status, 'ready')
  assert.equal(prepared.rows[0].student.plan, 'Essencial')
  assert.equal(prepared.rows[0].student.billingCycle, 'semestral')
  assert.match(prepared.rows[0].warnings.join(' '), /Plano da outra plataforma/)
  assert.equal(prepared.rows[0].student.status, 'Aguardando convite')
  assert.equal(prepared.rows[0].student.payment, 'Pendente')
  assert.equal(prepared.rows[0].student.requireAnamnesis, true)
})

test('gera modelo CSV compativel com o proprio importador', () => {
  const template = buildStudentImportTemplate()
  assert.match(template, /^nome,email,telefone,cpf,objetivo,plano\r?\n/)

  const parsed = prepareStudentImportRows({
    text: template,
    existingStudents: [],
    plans: [{ name: 'Acompanhamento mensal', cycle: 'mensal' }],
    defaultPlanName: 'Acompanhamento mensal',
  })
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.rows[0].status, 'ready')
})

test('contrato da interface inclui importacao, revisao e persistencia sem convite automatico', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const dialogSource = readFileSync(new URL('../src/StudentImportDialog.jsx', import.meta.url), 'utf8')

  assert.match(appSource, /async function importStudents\(rows\)/)
  assert.match(appSource, /onImport=\{importStudents\}/)
  assert.match(appSource, /Importar planilha/)
  assert.match(dialogSource, /Baixar modelo CSV/)
  assert.match(dialogSource, /Colar dados da planilha/)
  assert.match(dialogSource, /Revisar importa[cç][aã]o/)
  assert.match(dialogSource, /Importar .* v[aá]lidos/)

  const handler = appSource.slice(
    appSource.indexOf('async function importStudents(rows)'),
    appSource.indexOf('async function scheduleStudentCheckin'),
  )
  assert.match(handler, /saveRemoteStudent/)
  assert.doesNotMatch(handler, /createRemoteStudentInvite/)
})
