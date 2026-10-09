import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as questionnaireModel from '../src/questionnaireModel.js'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('prioriza a anamnese pendente mais antiga e não expõe um agendamento futuro', () => {
  assert.equal(typeof questionnaireModel.buildStudentQuestionnaireQueue, 'function')
  assert.equal(typeof questionnaireModel.getStudentQuestionnairePriority, 'function')

  const now = new Date('2026-10-09T15:00:00.000Z')
  const assignments = [
    { id: 'nutrition', status: 'Pendente', sentAt: '2026-10-06T10:00:00.000Z', questionSnapshot: { questionnaireType: 'nutrition' } },
    { id: 'future', status: 'Pendente', scheduledFor: '2026-10-10T10:00:00.000Z', priorityRequired: true, questionSnapshot: { questionnaireType: 'anamnesis' } },
    { id: 'new-anamnesis', status: 'Pendente', scheduledFor: '2026-10-09T12:00:00.000Z', priorityRequired: true, questionSnapshot: { questionnaireType: 'anamnesis' } },
    { id: 'old-anamnesis', status: 'Pendente', scheduledFor: '2026-10-08T12:00:00.000Z', priorityRequired: true, questionSnapshot: { questionnaireType: 'anamnesis' } },
  ]

  assert.deepEqual(questionnaireModel.buildStudentQuestionnaireQueue(assignments, now).map((item) => item.id), [
    'old-anamnesis',
    'new-anamnesis',
    'nutrition',
  ])
  assert.equal(questionnaireModel.getStudentQuestionnairePriority(assignments, [], now)?.id, 'old-anamnesis')
  assert.equal(questionnaireModel.getStudentQuestionnairePriority(assignments, ['old-anamnesis'], now)?.id, 'new-anamnesis')
})

test('anamnese prioritária abre a central sem participar dos bloqueios de acesso', () => {
  const dashboard = app.slice(app.indexOf('function StudentHomeDashboard('), app.indexOf('function StudentQuestionnaireCenter('))
  const studentApp = app.slice(app.indexOf('export function StudentMobileApp('), app.indexOf('function StudentHomeDashboard('))
  assert.match(dashboard, /Anamnese prioritária/)
  assert.match(dashboard, /priorityQuestionnaire\.priorityRequired/)
  assert.match(dashboard, /onOpenTab\('dieta'\)/)
  assert.match(dashboard, /não bloqueia/i)
  assert.doesNotMatch(studentApp.match(/const restrictedTabs = \[[^\]]+\]/)?.[0] || '', /question|anamn/i)
})

test('central diferencia anamnese e mantém a cópia e a recompensa do questionário nutricional', () => {
  assert.equal(typeof questionnaireModel.isGamifiedQuestionnaireAssignment, 'function')
  assert.equal(questionnaireModel.isGamifiedQuestionnaireAssignment({ questionSnapshot: { questionnaireType: 'anamnesis' } }), false)
  assert.equal(questionnaireModel.isGamifiedQuestionnaireAssignment({ questionSnapshot: { questionnaireType: 'nutrition' } }), true)
  const center = app.slice(app.indexOf('function StudentQuestionnaireCenter('), app.indexOf('const PRODUCT_DATE_FORMATTER'))
  assert.match(center, /isAnamnesisAssignment/)
  assert.match(center, /Concluir anamnese/)
  assert.match(center, /Questionário nutricional/)
  assert.match(center, /Questionário concluído! Você ganhou \$\{QUESTIONNAIRE_XP_REWARD\} XP\./)
})

test('portal remoto atualiza uma vez quando volta ao primeiro plano', () => {
  const sync = app.slice(app.indexOf('async function syncStudentPortalAccess()'), app.indexOf('const inviteCode = studentAccess'))
  assert.match(sync, /function refreshStudentPortalWhenVisible/)
  assert.match(sync, /document\.visibilityState !== 'visible'/)
  assert.match(sync, /document\.addEventListener\('visibilitychange', refreshStudentPortalWhenVisible\)/)
  assert.match(sync, /document\.removeEventListener\('visibilitychange', refreshStudentPortalWhenVisible\)/)
  assert.match(sync, /if \(pending/)
})

test('resumo da dieta usa a linha canônica e apenas o snapshot respondido mais recente para rótulos', () => {
  assert.equal(typeof questionnaireModel.buildAnamnesisCustomAnswers, 'function')
  const anamnesis = {
    studentId: 'student-1',
    answers: { primaryGoal: 'Saúde', custom_sleep: 'Acordo duas vezes' },
    updatedAt: '2026-10-09T14:00:00.000Z',
  }
  const assignments = [
    {
      id: 'pending', studentId: 'student-1', status: 'Pendente',
      answers: { custom_sleep: 'NÃO USAR' },
      questionSnapshot: { questionnaireType: 'anamnesis', questions: [{ id: 'custom_sleep', label: 'Rótulo pendente' }] },
    },
    {
      id: 'completed', studentId: 'student-1', status: 'Respondido', completedAt: '2026-10-09T13:59:00.000Z',
      questionSnapshot: { questionnaireType: 'anamnesis', questions: [{ id: 'custom_sleep', label: 'Como está seu sono hoje?' }] },
    },
  ]
  assert.deepEqual(questionnaireModel.buildAnamnesisCustomAnswers(anamnesis, assignments), [
    { id: 'custom_sleep', label: 'Como está seu sono hoje?', value: 'Acordo duas vezes' },
  ])

  const summary = app.slice(app.indexOf('function ProfessionalAnamnesisSummary('), app.indexOf('function AnamnesisStat('))
  assert.match(summary, /buildAnamnesisCustomAnswers/)
  assert.match(summary, /Perguntas personalizadas/)
  assert.match(summary, /Atualizada em/)
  assert.match(summary, /Preenchida pelo profissional|Enviada pelo aluno\/paciente/)
  assert.match(css, /student-anamnesis-priority-card/)
})
