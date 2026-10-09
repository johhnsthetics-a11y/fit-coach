import { useEffect, useMemo, useRef, useState } from 'react'
import {
  QUESTIONNAIRE_TYPES,
  createQuestionnaireDraft,
  moveQuestion,
  removeQuestion,
  validateQuestionnaireDraft,
} from './questionnaireModel'

const QUESTION_TYPE_OPTIONS = [
  { value: 'text', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'single', label: 'Escolha única' },
  { value: 'multiple', label: 'Múltipla escolha' },
  { value: 'scale', label: 'Escala de 1 a 5' },
]

function formatDateTime(value) {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function assignmentState(assignment) {
  if (assignment.status === 'Respondido') return 'Respondida'
  if (assignment.scheduledFor && new Date(assignment.scheduledFor) > new Date()) return 'Agendada'
  return 'Aguardando resposta'
}

export default function StudentAnamnesisWorkspace({
  nutritionist = false,
  students = [],
  templates = [],
  assignments = [],
  selectedStudent,
  onSelectStudent,
  onSaveTemplate,
  onAssignTemplate,
  uiTheme = 'dark',
}) {
  const [draft, setDraft] = useState(() => createQuestionnaireDraft({}, QUESTIONNAIRE_TYPES.ANAMNESIS))
  const [selectedStudentId, setSelectedStudentId] = useState(selectedStudent?.id || '')
  const [deliveryMode, setDeliveryMode] = useState('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const [priorityRequired, setPriorityRequired] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const busyRef = useRef(false)
  const audience = nutritionist ? 'paciente' : 'aluno'
  const audiencePlural = nutritionist ? 'Pacientes' : 'Alunos'

  const anamnesisTemplates = useMemo(
    () => templates.filter((template) => template.questionnaireType === QUESTIONNAIRE_TYPES.ANAMNESIS),
    [templates],
  )
  const anamnesisAssignments = useMemo(
    () => assignments
      .filter((assignment) => assignment.questionSnapshot?.questionnaireType === QUESTIONNAIRE_TYPES.ANAMNESIS)
      .slice()
      .sort((a, b) => new Date(b.completedAt || b.scheduledFor || b.sentAt || 0) - new Date(a.completedAt || a.scheduledFor || a.sentAt || 0)),
    [assignments],
  )

  useEffect(() => {
    if (selectedStudent?.id) setSelectedStudentId(selectedStudent.id)
  }, [selectedStudent?.id])

  function updateQuestion(questionId, field, value) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) => String(question.id) === String(questionId)
        ? { ...question, [field]: value }
        : question),
    }))
    setMessage('')
  }

  function addQuestion() {
    setDraft((current) => createQuestionnaireDraft({
      ...current,
      questions: [
        ...current.questions,
        { type: 'text', label: 'Nova pergunta', required: false, options: [] },
      ],
    }, QUESTIONNAIRE_TYPES.ANAMNESIS))
    setMessage('')
  }

  async function persistTemplate(status = 'Rascunho') {
    const validation = validateQuestionnaireDraft(draft)
    if (!validation.valid) {
      setMessage(validation.message)
      return null
    }
    const saved = await onSaveTemplate({
      ...draft,
      status,
      questionnaireType: QUESTIONNAIRE_TYPES.ANAMNESIS,
    })
    setDraft(createQuestionnaireDraft(saved || draft, QUESTIONNAIRE_TYPES.ANAMNESIS))
    return saved || draft
  }

  async function handleSave() {
    if (busyRef.current) return
    busyRef.current = true
    setSaving(true)
    setMessage('')
    try {
      const saved = await persistTemplate('Rascunho')
      if (saved) setMessage('Modelo de anamnese salvo.')
    } catch (error) {
      setMessage(error.message || 'Não foi possível salvar o modelo.')
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  async function handleAssign() {
    if (busyRef.current) return
    if (!selectedStudentId) {
      setMessage(`Selecione ${nutritionist ? 'uma pessoa' : 'um aluno'} para enviar a anamnese.`)
      return
    }
    busyRef.current = true
    setSaving(true)
    setMessage('')
    try {
      const saved = await persistTemplate('Enviado')
      if (!saved?.id) return
      let scheduledDate = deliveryMode === 'scheduled' ? new Date(scheduledFor) : new Date()
      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) scheduledDate = new Date()
      await onAssignTemplate({
        questionnaireId: saved.id,
        studentId: selectedStudentId,
        scheduledFor: scheduledDate.toISOString(),
        priorityRequired,
      })
      const target = students.find((student) => String(student.id) === String(selectedStudentId))
      onSelectStudent?.(selectedStudentId)
      setMessage(deliveryMode === 'scheduled' && scheduledDate > new Date()
        ? `Anamnese agendada para ${target?.name || `o ${audience}`}.`
        : `Anamnese enviada para ${target?.name || `o ${audience}`}.`)
    } catch (error) {
      setMessage(error.message || 'Não foi possível enviar a anamnese.')
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  return (
    <section className={`student-anamnesis-workspace theme-${uiTheme}`} aria-label="Organização de anamneses">
      <header className="student-anamnesis-workspace__header">
        <div>
          <p>Anamnese personalizada</p>
          <h2>Crie, programe e acompanhe</h2>
          <span>Organize as perguntas que fazem sentido para o seu atendimento e mantenha a resposta mais recente disponível na prescrição.</span>
        </div>
        <button type="button" onClick={() => setDraft(createQuestionnaireDraft({}, QUESTIONNAIRE_TYPES.ANAMNESIS))}>
          Novo modelo
        </button>
      </header>

      <nav className="student-anamnesis-workspace__templates" aria-label="Modelos de anamnese">
        <strong>Modelos salvos</strong>
        <div>
          {anamnesisTemplates.length ? anamnesisTemplates.map((template) => (
            <button
              type="button"
              key={template.id}
              className={String(template.id) === String(draft.id) ? 'is-active' : ''}
              onClick={() => setDraft(createQuestionnaireDraft(template, QUESTIONNAIRE_TYPES.ANAMNESIS))}
            >
              <span>{template.title}</span>
              <small>{template.questions?.length || 0} perguntas</small>
            </button>
          )) : <p>Nenhum modelo salvo. O primeiro modelo já está pronto para personalização.</p>}
        </div>
      </nav>

      <div className="student-anamnesis-workspace__main">
        <section className="student-anamnesis-editor" aria-labelledby="anamnesis-editor-title">
          <div className="student-anamnesis-section-heading">
            <div>
              <p>Editor</p>
              <h3 id="anamnesis-editor-title">Perguntas da anamnese</h3>
            </div>
            <button type="button" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar modelo'}</button>
          </div>

          <label>
            <span>Título</span>
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            <span>Orientação para o {audience}</span>
            <textarea rows="2" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>

          <div className="student-anamnesis-editor__questions">
            {draft.questions.map((question, index) => (
              <article key={question.id}>
                <div className="student-anamnesis-question__toolbar">
                  <strong>Pergunta {index + 1}</strong>
                  <span>
                    <button type="button" aria-label="Mover pergunta para cima" title="Mover para cima" disabled={index === 0} onClick={() => setDraft((current) => ({ ...current, questions: moveQuestion(current.questions, question.id, -1) }))}>↑</button>
                    <button type="button" aria-label="Mover pergunta para baixo" title="Mover para baixo" disabled={index === draft.questions.length - 1} onClick={() => setDraft((current) => ({ ...current, questions: moveQuestion(current.questions, question.id, 1) }))}>↓</button>
                    <button type="button" aria-label="Remover pergunta" title="Remover pergunta" onClick={() => setDraft((current) => ({ ...current, questions: removeQuestion(current.questions, question.id) }))}>×</button>
                  </span>
                </div>
                <div className="student-anamnesis-question__fields">
                  <label>
                    <span>Enunciado</span>
                    <input value={question.label} onChange={(event) => updateQuestion(question.id, 'label', event.target.value)} />
                  </label>
                  <label>
                    <span>Tipo</span>
                    <select value={question.type} onChange={(event) => updateQuestion(question.id, 'type', event.target.value)}>
                      {QUESTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="student-anamnesis-question__required">
                    <input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, 'required', event.target.checked)} />
                    <span>Obrigatória</span>
                  </label>
                </div>
                {['single', 'multiple'].includes(question.type) ? (
                  <label>
                    <span>Opções separadas por vírgula</span>
                    <input value={question.options.join(', ')} onChange={(event) => updateQuestion(question.id, 'options', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} />
                  </label>
                ) : null}
              </article>
            ))}
          </div>
          <button type="button" className="student-anamnesis-add-question" onClick={addQuestion}>+ Adicionar pergunta</button>
        </section>

        <aside className="student-anamnesis-delivery" aria-labelledby="anamnesis-delivery-title">
          <div className="student-anamnesis-section-heading">
            <div>
              <p>Envio</p>
              <h3 id="anamnesis-delivery-title">Disponibilizar ao {audience}</h3>
            </div>
          </div>
          <label>
            <span>{audiencePlural}</span>
            <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
              <option value="">Selecione {nutritionist ? 'uma pessoa' : 'um aluno'}</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>Quando enviar</legend>
            <label><input type="radio" name="anamnesis-delivery" value="now" checked={deliveryMode === 'now'} onChange={() => setDeliveryMode('now')} /> Agora</label>
            <label><input type="radio" name="anamnesis-delivery" value="scheduled" checked={deliveryMode === 'scheduled'} onChange={() => setDeliveryMode('scheduled')} /> Agendar</label>
          </fieldset>
          {deliveryMode === 'scheduled' ? (
            <label>
              <span>Data e hora</span>
              <input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
            </label>
          ) : null}
          <label className="student-anamnesis-priority">
            <input type="checkbox" checked={priorityRequired} onChange={(event) => setPriorityRequired(event.target.checked)} />
            <span><strong>Mostrar como prioridade</strong><small>Destaca a tarefa para o {audience}, mas não bloqueia o acesso às outras ferramentas.</small></span>
          </label>
          <button type="button" className="student-anamnesis-send" disabled={saving || !students.length} onClick={handleAssign}>
            {saving ? 'Processando...' : deliveryMode === 'scheduled' ? 'Agendar envio' : 'Enviar agora'}
          </button>
          {message ? <p className="student-anamnesis-message" role="status">{message}</p> : null}
        </aside>
      </div>

      <section className="student-anamnesis-history" aria-labelledby="anamnesis-history-title">
        <div className="student-anamnesis-section-heading">
          <div>
            <p>Acompanhamento</p>
            <h3 id="anamnesis-history-title">Histórico de envios</h3>
          </div>
          <span>{anamnesisAssignments.length}</span>
        </div>
        <div className="student-anamnesis-history__list">
          {anamnesisAssignments.length ? anamnesisAssignments.map((assignment) => {
            const student = students.find((item) => String(item.id) === String(assignment.studentId))
            const state = assignmentState(assignment)
            return (
              <article key={assignment.id} data-state={state.toLowerCase().replaceAll(' ', '-')}>
                <div>
                  <strong>{assignment.questionSnapshot?.title || 'Anamnese'}</strong>
                  <span>{student?.name || `Sem ${audience} vinculado`}</span>
                </div>
                <div>
                  <strong>{state}</strong>
                  <span>{formatDateTime(assignment.completedAt || assignment.scheduledFor || assignment.sentAt)}</span>
                </div>
              </article>
            )
          }) : <p>Nenhuma anamnese enviada ainda.</p>}
        </div>
      </section>
    </section>
  )
}
