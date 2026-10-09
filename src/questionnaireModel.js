export const QUESTIONNAIRE_TYPES = Object.freeze({
  NUTRITION: 'nutrition',
  ANAMNESIS: 'anamnesis',
})

export const QUESTION_TYPES = Object.freeze(['text', 'number', 'date', 'single', 'multiple', 'scale'])

const DEFAULTS = {
  [QUESTIONNAIRE_TYPES.NUTRITION]: {
    title: 'Questionário nutricional',
    description: 'Preferências, rotina e restrições para ajustar o plano alimentar.',
    questions: [
      { type: 'text', label: 'Quais alimentos você não gosta ou evita?', required: false, options: [] },
      { type: 'multiple', label: 'Quais refeições costuma fazer no dia?', required: true, options: ['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Ceia'] },
      { type: 'single', label: 'Você possui alguma restrição alimentar?', required: true, options: ['Não', 'Lactose', 'Glúten', 'Vegetariano', 'Outra'] },
    ],
  },
  [QUESTIONNAIRE_TYPES.ANAMNESIS]: {
    title: 'Anamnese de acompanhamento',
    description: 'Informações de saúde, rotina e objetivos para personalizar o acompanhamento.',
    questions: [
      { type: 'text', label: 'Qual é o seu principal objetivo neste acompanhamento?', required: true, options: [] },
      { type: 'text', label: 'Possui lesões, dores ou limitações importantes?', required: true, options: [] },
      { type: 'text', label: 'Há alguma condição de saúde ou uso de medicamento que o profissional deva conhecer?', required: true, options: [] },
    ],
  },
}

function createQuestionId() {
  if (globalThis.crypto?.randomUUID) return `question-${globalThis.crypto.randomUUID()}`
  return `question-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeQuestionnaireType(value) {
  return Object.values(QUESTIONNAIRE_TYPES).includes(value) ? value : QUESTIONNAIRE_TYPES.NUTRITION
}

function normalizeOptions(value) {
  const options = Array.isArray(value) ? value : String(value || '').split(',')
  return options.map((item) => String(item || '').trim()).filter(Boolean)
}

function normalizeQuestion(question = {}, index = 0) {
  const type = QUESTION_TYPES.includes(question.type) ? question.type : 'text'
  return {
    ...question,
    id: String(question.id || '').trim() || createQuestionId(),
    type,
    label: String(question.label || '').trim() || `Pergunta ${index + 1}`,
    required: Boolean(question.required),
    options: ['single', 'multiple'].includes(type) ? normalizeOptions(question.options) : [],
  }
}

export function createQuestionnaireDraft(source = {}, requestedType) {
  const sourceType = source.questionnaireType || source.questionnaire_type
  const questionnaireType = normalizeQuestionnaireType(requestedType || sourceType)
  const defaults = DEFAULTS[questionnaireType]
  const sourceQuestions = Array.isArray(source.questions) && source.questions.length
    ? source.questions
    : defaults.questions

  return {
    ...source,
    id: source.id || '',
    title: String(source.title || defaults.title),
    description: String(source.description || defaults.description),
    status: source.status || 'Rascunho',
    questionnaireType,
    questions: sourceQuestions.map(normalizeQuestion),
  }
}

export function validateQuestionnaireDraft(draft = {}) {
  if (!String(draft.title || '').trim()) {
    return { valid: false, message: 'Informe o título do modelo.' }
  }
  if (!Array.isArray(draft.questions) || !draft.questions.length) {
    return { valid: false, message: 'Adicione pelo menos uma pergunta.' }
  }
  if (draft.questions.some((question) => !String(question.label || '').trim())) {
    return { valid: false, message: 'Preencha o texto de todas as perguntas.' }
  }
  if (draft.questions.some((question) => ['single', 'multiple'].includes(question.type) && !normalizeOptions(question.options).length)) {
    return { valid: false, message: 'Informe as opções das perguntas de seleção.' }
  }
  return { valid: true, message: '' }
}

export function removeQuestion(questions = [], questionId) {
  return (Array.isArray(questions) ? questions : []).filter((question) => String(question.id) !== String(questionId))
}

export function moveQuestion(questions = [], questionId, direction) {
  const next = (Array.isArray(questions) ? questions : []).slice()
  const index = next.findIndex((question) => String(question.id) === String(questionId))
  const offset = direction === -1 ? -1 : direction === 1 ? 1 : 0
  const targetIndex = index + offset
  if (index < 0 || !offset || targetIndex < 0 || targetIndex >= next.length) return next
  ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
  return next
}
