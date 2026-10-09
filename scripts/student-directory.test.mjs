import test from 'node:test'
import assert from 'node:assert/strict'

import { filterStudents, normalizeStudentSearch } from '../src/studentDirectory.js'

const students = [
  { id: '1', name: 'João Ávila', email: 'joao.avila@example.com', cpf: '123.456.789-00' },
  { id: '2', name: 'Marina Costa', email: 'marina@coachfit.com.br', cpf: '98765432100' },
  { id: '3', name: 'Caio Souza', email: 'caio@example.com', cpf: '' },
]

test('busca alunos por nome sem diferenciar acentos ou maiúsculas', () => {
  assert.equal(normalizeStudentSearch('  JOÃO '), 'joao')
  assert.deepEqual(filterStudents(students, 'JOAO').map((student) => student.id), ['1'])
})

test('busca alunos por e-mail parcial', () => {
  assert.deepEqual(filterStudents(students, 'coachfit.com').map((student) => student.id), ['2'])
})

test('busca CPF formatado e somente dígitos', () => {
  assert.deepEqual(filterStudents(students, '123.456').map((student) => student.id), ['1'])
  assert.deepEqual(filterStudents(students, '98765432100').map((student) => student.id), ['2'])
})

test('consulta vazia preserva ordem e todos os alunos sem mutar a origem', () => {
  const before = structuredClone(students)
  const result = filterStudents(students, '   ')

  assert.deepEqual(result.map((student) => student.id), ['1', '2', '3'])
  assert.deepEqual(students, before)
  assert.notEqual(result, students)
})

test('consulta sem correspondência retorna lista vazia', () => {
  assert.deepEqual(filterStudents(students, 'não existe'), [])
})
