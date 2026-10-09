import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  QUESTIONNAIRE_TYPES,
  createQuestionnaireDraft,
  moveQuestion,
  removeQuestion,
  validateQuestionnaireDraft,
} from '../src/questionnaireModel.js'

test('questionnaire drafts preserve known ids and create stable independent questions', () => {
  const source = {
    id: 'model-1',
    title: 'Minha anamnese',
    questions: [
      { id: 'known-question', type: 'text', label: 'Objetivo', required: true },
      { type: 'number', label: 'Idade', required: false },
    ],
  }
  const snapshot = structuredClone(source)
  const draft = createQuestionnaireDraft(source, QUESTIONNAIRE_TYPES.ANAMNESIS)

  assert.equal(draft.questionnaireType, 'anamnesis')
  assert.equal(draft.questions[0].id, 'known-question')
  assert.ok(draft.questions[1].id)
  assert.notEqual(draft.questions[0], source.questions[0])
  assert.deepEqual(source, snapshot)
})

test('nutrition and anamnesis defaults remain separate and invalid types fall back to nutrition', () => {
  const nutrition = createQuestionnaireDraft({}, 'unknown')
  const anamnesis = createQuestionnaireDraft({}, QUESTIONNAIRE_TYPES.ANAMNESIS)

  assert.equal(nutrition.questionnaireType, 'nutrition')
  assert.equal(anamnesis.questionnaireType, 'anamnesis')
  assert.notEqual(nutrition.title, anamnesis.title)
  assert.notDeepEqual(nutrition.questions.map((question) => question.label), anamnesis.questions.map((question) => question.label))
})

test('questionnaire validation requires title, questions, labels and selection options', () => {
  assert.equal(validateQuestionnaireDraft({ title: '', questions: [] }).valid, false)
  assert.match(validateQuestionnaireDraft({ title: 'Modelo', questions: [] }).message, /pergunta/i)
  assert.equal(validateQuestionnaireDraft({
    title: 'Modelo',
    questions: [{ id: 'q1', label: 'Selecione', type: 'single', options: [] }],
  }).valid, false)
  assert.equal(validateQuestionnaireDraft({
    title: 'Modelo',
    questions: [{ id: 'q1', label: 'Selecione', type: 'single', options: ['Sim', 'Não'] }],
  }).valid, true)
})

test('question removal and movement do not mutate the source and respect boundaries', () => {
  const questions = [
    { id: 'one', label: 'Um' },
    { id: 'two', label: 'Dois' },
    { id: 'three', label: 'Três' },
  ]
  const snapshot = structuredClone(questions)

  assert.deepEqual(removeQuestion(questions, 'two').map((question) => question.id), ['one', 'three'])
  assert.deepEqual(moveQuestion(questions, 'two', -1).map((question) => question.id), ['two', 'one', 'three'])
  assert.deepEqual(moveQuestion(questions, 'two', 1).map((question) => question.id), ['one', 'three', 'two'])
  assert.deepEqual(moveQuestion(questions, 'one', -1), questions)
  assert.deepEqual(moveQuestion(questions, 'three', 1), questions)
  assert.notEqual(moveQuestion(questions, 'one', -1), questions)
  assert.deepEqual(questions, snapshot)
})

test('Supabase API persists type, schedule and priority through explicit contracts', async () => {
  const source = await readFile(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
  assert.match(source, /questionnaireType:\s*row\.questionnaire_type/)
  assert.match(source, /questionnaire_type:\s*questionnaire\.questionnaireType/)
  assert.match(source, /scheduledFor:\s*row\.scheduled_for/)
  assert.match(source, /priorityRequired:\s*Boolean\(row\.priority_required\)/)
  assert.match(source, /export async function assignRemoteStudentAnamnesis/)
  assert.match(source, /rpcRequest\('assign_student_anamnesis'/)
})
