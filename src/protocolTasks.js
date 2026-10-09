const CATEGORIES = new Set(['training', 'nutrition', 'follow_up', 'general'])
const PRIORITIES = new Set(['low', 'normal', 'high'])
const STATUSES = new Set(['pending', 'in_progress', 'done', 'canceled'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function normalizeProtocolTaskDraft(draft = {}) {
  const title = String(draft.title ?? '').trim()
  const category = draft.category || 'general'
  const priority = draft.priority || 'normal'
  const status = draft.status || 'pending'
  const plannedDate = String(draft.plannedDate ?? '')
  const studentId = String(draft.studentId ?? '').trim() || null

  if (!title) throw new Error('Informe um título para a tarefa.')
  if (!CATEGORIES.has(category)) throw new Error('Selecione uma categoria válida.')
  if (!PRIORITIES.has(priority)) throw new Error('Selecione uma prioridade válida.')
  if (!STATUSES.has(status)) throw new Error('Selecione um status válido.')
  if (!isValidDateKey(plannedDate)) throw new Error('Informe uma data válida para a tarefa.')
  if (studentId && !UUID_PATTERN.test(studentId)) throw new Error('Selecione um aluno ou paciente válido.')

  return {
    title,
    category,
    plannedDate,
    priority,
    status,
    studentId,
    notes: String(draft.notes ?? '').trim(),
  }
}

export function protocolTaskFromRow(row = {}) {
  return {
    id: row.id,
    coachId: row.coach_id,
    studentId: row.student_id || null,
    title: row.title || '',
    category: row.category || 'general',
    plannedDate: row.planned_date || '',
    priority: row.priority || 'normal',
    status: row.status || 'pending',
    notes: row.notes || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export function protocolTaskToRow(task, coachId) {
  if (!UUID_PATTERN.test(String(coachId ?? ''))) throw new Error('Profissional não identificado para salvar a tarefa.')
  const normalized = normalizeProtocolTaskDraft(task)
  const id = String(task?.id ?? '').trim()
  if (id && !UUID_PATTERN.test(id)) throw new Error('Identificador da tarefa inválido.')

  return {
    ...(id ? { id } : {}),
    coach_id: coachId,
    student_id: normalized.studentId,
    title: normalized.title,
    category: normalized.category,
    planned_date: normalized.plannedDate,
    priority: normalized.priority,
    notes: normalized.notes,
    status: normalized.status,
    updated_at: new Date().toISOString(),
  }
}

export function formatProtocolDateKey(dateKey) {
  if (!isValidDateKey(dateKey)) return ''
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const categoryLabels = {
  training: 'Treino',
  nutrition: 'Nutrição',
  follow_up: 'Acompanhamento',
  general: 'Geral',
}

const priorityLabels = { low: 'Baixa', normal: 'Normal', high: 'Alta' }
const statusLabels = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluída', canceled: 'Cancelada' }

export function buildProtocolTasksPrintHtml({ tasks = [], students = [], professional = {}, fromDate = '', toDate = '', filters = {} } = {}) {
  const studentNames = new Map(students.map(student => [student.id, student.name || 'Pessoa sem nome']))
  const rows = tasks.length
    ? tasks.map(task => `
      <article class="task">
        <div class="task-head"><span>${escapeHtml(formatProtocolDateKey(task.plannedDate))}</span><strong>${escapeHtml(task.title)}</strong></div>
        <p>${escapeHtml(categoryLabels[task.category] || categoryLabels.general)} · ${escapeHtml(priorityLabels[task.priority] || priorityLabels.normal)} · ${escapeHtml(statusLabels[task.status] || statusLabels.pending)}</p>
        ${task.studentId ? `<p>Vínculo: ${escapeHtml(studentNames.get(task.studentId) || 'Aluno/paciente removido')}</p>` : ''}
        ${task.notes ? `<div class="notes">${escapeHtml(task.notes)}</div>` : ''}
      </article>
    `).join('')
    : '<p class="empty">Nenhuma tarefa encontrada para o período selecionado.</p>'
  const period = fromDate && toDate
    ? `${formatProtocolDateKey(fromDate)} a ${formatProtocolDateKey(toDate)}`
    : formatProtocolDateKey(fromDate || toDate) || 'Todos os períodos'
  const filterSummary = [
    filters.category && filters.category !== 'all' ? categoryLabels[filters.category] : '',
    filters.priority && filters.priority !== 'all' ? `Prioridade ${priorityLabels[filters.priority]?.toLowerCase() || ''}` : '',
    filters.status && filters.status !== 'all' ? statusLabels[filters.status] : '',
    filters.studentId && filters.studentId !== 'all'
      ? studentNames.get(filters.studentId) || 'Aluno/paciente selecionado'
      : '',
  ].filter(Boolean).join(' · ')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Organização de Protocolos · Coach Fit Pro</title>
<style>
@page{margin:16mm}*{box-sizing:border-box}body{margin:0;color:#17211f;font:14px/1.5 Arial,sans-serif}.page{max-width:900px;margin:auto}header{border-bottom:2px solid #00b89c;padding-bottom:16px;margin-bottom:18px}.brand{color:#008d78;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}h1{margin:5px 0;font-size:26px}.meta{color:#52605d;font-size:12px}.task{break-inside:avoid;border:1px solid #d8e5e2;border-radius:10px;padding:12px 14px;margin:10px 0}.task-head{display:flex;gap:12px;align-items:baseline}.task-head span{min-width:78px;color:#008d78;font-weight:700}.task-head strong{font-size:15px}.task p{margin:5px 0 0;color:#53605d;font-size:12px}.notes{margin-top:8px;white-space:pre-wrap}.empty{border:1px dashed #b9cbc7;padding:16px;color:#52605d}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><main class="page"><header><div class="brand">Coach Fit Pro · Organização de Protocolos</div><h1>Planejamento profissional</h1><div class="meta">Profissional: ${escapeHtml(professional.name || professional.email || 'Profissional')} · Período: ${escapeHtml(period)}${filterSummary ? ` · Filtros: ${escapeHtml(filterSummary)}` : ''}</div></header>${rows}</main><script>window.addEventListener('load',()=>{window.focus();window.print()})</script></body></html>`
}
