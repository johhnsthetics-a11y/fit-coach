import { useEffect, useMemo, useState } from 'react'
import {
  buildProtocolTasksPrintHtml,
  formatProtocolDateKey,
  normalizeProtocolTaskDraft,
} from './protocolTasks'
import {
  deleteRemoteProtocolTask,
  loadRemoteProtocolTasks,
  saveRemoteProtocolTask,
} from './supabaseApi'
import './OrganizationProtocols.css'

const categories = [
  ['training', 'Treino'],
  ['nutrition', 'Nutrição'],
  ['follow_up', 'Acompanhamento'],
  ['general', 'Geral'],
]
const priorities = [['low', 'Baixa'], ['normal', 'Normal'], ['high', 'Alta']]
const statuses = [['pending', 'Pendente'], ['in_progress', 'Em andamento'], ['done', 'Concluída'], ['canceled', 'Cancelada']]

function localDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function shiftDate(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

function getWeekRange(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const mondayOffset = (date.getDay() + 6) % 7
  const start = shiftDate(dateKey, -mondayOffset)
  return { start, end: shiftDate(start, 6) }
}

function dayName(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(year, month - 1, day))
}

function taskDraft(task = {}, plannedDate = localDateKey()) {
  return {
    ...(task.id ? { id: task.id } : {}),
    title: task.title || '',
    category: task.category || 'general',
    plannedDate: task.plannedDate || plannedDate,
    priority: task.priority || 'normal',
    status: task.status || 'pending',
    studentId: task.studentId || '',
    notes: task.notes || '',
  }
}

function optionLabel(options, value) {
  return options.find(([key]) => key === value)?.[1] || ''
}

export default function OrganizationProtocols({ coachId, students = [], professionalType = 'trainer', professional = {}, uiTheme = 'dark' }) {
  const personLabel = professionalType === 'nutritionist' ? 'Paciente' : 'Aluno'
  const [viewMode, setViewMode] = useState('week')
  const [anchorDate, setAnchorDate] = useState(localDateKey())
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState(() => taskDraft())
  const [filters, setFilters] = useState({ category: 'all', priority: 'all', status: 'all', studentId: 'all' })

  const range = useMemo(() => viewMode === 'week'
    ? getWeekRange(anchorDate)
    : { start: anchorDate, end: anchorDate }, [anchorDate, viewMode])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setTasks([])
    loadRemoteProtocolTasks(coachId, range)
      .then((loaded) => { if (active) setTasks(loaded) })
      .catch((loadError) => { if (active) setError(loadError?.message || 'Não foi possível carregar as tarefas.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [coachId, range.start, range.end])

  const visibleTasks = useMemo(() => tasks.filter((task) => (
    (filters.category === 'all' || task.category === filters.category)
    && (filters.priority === 'all' || task.priority === filters.priority)
    && (filters.status === 'all' || task.status === filters.status)
    && (filters.studentId === 'all' || String(task.studentId || '') === filters.studentId)
  )), [filters, tasks])

  const counts = useMemo(() => ({
    pending: tasks.filter(task => task.status === 'pending').length,
    inProgress: tasks.filter(task => task.status === 'in_progress').length,
    done: tasks.filter(task => task.status === 'done').length,
  }), [tasks])

  const taskGroups = useMemo(() => {
    const groups = new Map()
    visibleTasks.forEach((task) => {
      if (!groups.has(task.plannedDate)) groups.set(task.plannedDate, [])
      groups.get(task.plannedDate).push(task)
    })
    return [...groups.entries()].sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
  }, [visibleTasks])

  function movePeriod(direction) {
    setAnchorDate(shiftDate(anchorDate, direction * (viewMode === 'week' ? 7 : 1)))
  }

  async function refreshTasks() {
    setLoading(true)
    setError('')
    try {
      setTasks(await loadRemoteProtocolTasks(coachId, range))
    } catch (loadError) {
      setError(loadError?.message || 'Não foi possível atualizar as tarefas.')
    } finally {
      setLoading(false)
    }
  }

  function startNewTask() {
    setDraft(taskDraft({}, anchorDate))
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function editTask(task) {
    setDraft(taskDraft(task))
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  async function saveTask(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const normalized = normalizeProtocolTaskDraft(draft)
      const saved = await saveRemoteProtocolTask({ ...normalized, ...(draft.id ? { id: draft.id } : {}) }, coachId)
      setTasks(current => [...current.filter(task => String(task.id) !== String(saved.id)), saved]
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.title.localeCompare(b.title, 'pt-BR')))
      setFormOpen(false)
      setDraft(taskDraft({}, anchorDate))
      setNotice('Tarefa salva e sincronizada.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível salvar. Seus dados continuam no formulário.')
    } finally {
      setSaving(false)
    }
  }

  async function updateTaskStatus(task, status) {
    setBusyTaskId(String(task.id))
    setError('')
    setNotice('')
    try {
      const saved = await saveRemoteProtocolTask({ ...task, status }, coachId)
      setTasks(current => current.map(item => String(item.id) === String(saved.id) ? saved : item))
      setNotice(status === 'done' ? 'Tarefa concluída.' : status === 'in_progress' ? 'Tarefa iniciada.' : 'Tarefa reaberta.')
    } catch (saveError) {
      setError(saveError?.message || 'Não foi possível atualizar a tarefa.')
    } finally {
      setBusyTaskId('')
    }
  }

  async function removeTask(task) {
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) return
    setBusyTaskId(String(task.id))
    setError('')
    setNotice('')
    try {
      await deleteRemoteProtocolTask(task.id, coachId)
      setTasks(current => current.filter(item => String(item.id) !== String(task.id)))
      setNotice('Tarefa excluída.')
      if (String(draft.id) === String(task.id)) setFormOpen(false)
    } catch (deleteError) {
      setError(deleteError?.message || 'Não foi possível excluir a tarefa.')
    } finally {
      setBusyTaskId('')
    }
  }

  function printTasks() {
    const html = buildProtocolTasksPrintHtml({
      tasks: visibleTasks,
      students,
      professional,
      fromDate: range.start,
      toDate: range.end,
      filters,
    })
    const printWindow = window.open('', '_blank', 'width=980,height=760')
    if (!printWindow) {
      setError('Permita pop-ups neste site para exportar o PDF.')
      return
    }
    printWindow.opener = null
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    setError('')
  }

  const periodLabel = viewMode === 'day'
    ? `${dayName(anchorDate)}, ${formatProtocolDateKey(anchorDate)}`
    : `${formatProtocolDateKey(range.start)} a ${formatProtocolDateKey(range.end)}`

  return (
    <section className={`protocol-planner app-theme-${uiTheme}`} aria-labelledby="protocol-planner-title">
      <header className="protocol-planner__header">
        <div>
          <p className="protocol-planner__eyebrow">Planejamento profissional</p>
          <h2 id="protocol-planner-title">Organização de Protocolos</h2>
          <p>Planeje revisões, ajustes e acompanhamentos por pessoa e por data.</p>
        </div>
        <button type="button" className="protocol-button protocol-button--primary" onClick={startNewTask}>+ Nova tarefa</button>
      </header>

      <div className="protocol-toolbar">
        <div className="protocol-period-controls" aria-label="Navegação do período">
          <button type="button" className="protocol-button" onClick={() => movePeriod(-1)} aria-label="Período anterior">‹</button>
          <strong>{periodLabel}</strong>
          <button type="button" className="protocol-button" onClick={() => movePeriod(1)} aria-label="Próximo período">›</button>
          <button type="button" className="protocol-button" onClick={() => setAnchorDate(localDateKey())}>Hoje</button>
        </div>
        <div className="protocol-toolbar__actions">
          <div className="protocol-segmented" role="group" aria-label="Visualização do período">
            <button type="button" aria-pressed={viewMode === 'day'} onClick={() => setViewMode('day')}>Dia</button>
            <button type="button" aria-pressed={viewMode === 'week'} onClick={() => setViewMode('week')}>Semana</button>
          </div>
          <button type="button" className="protocol-button" onClick={refreshTasks} disabled={loading}>Atualizar</button>
          <button type="button" className="protocol-button" onClick={printTasks} disabled={!visibleTasks.length}>Imprimir / salvar em PDF</button>
        </div>
      </div>

      <div className="protocol-counts" aria-label="Resumo das tarefas">
        <div><span>Pendentes</span><strong>{counts.pending}</strong></div>
        <div><span>Em andamento</span><strong>{counts.inProgress}</strong></div>
        <div><span>Concluídas</span><strong>{counts.done}</strong></div>
      </div>

      <div className="protocol-filters" aria-label="Filtros das tarefas">
        <label>Categoria<select value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}>
          <option value="all">Todas</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Prioridade<select value={filters.priority} onChange={event => setFilters(current => ({ ...current, priority: event.target.value }))}>
          <option value="all">Todas</option>{priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Status<select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}>
          <option value="all">Todos</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>{personLabel}<select value={filters.studentId} onChange={event => setFilters(current => ({ ...current, studentId: event.target.value }))}>
          <option value="all">Todos</option><option value="">Sem vínculo</option>{students.map(student => <option key={student.id} value={String(student.id)}>{student.name}</option>)}
        </select></label>
      </div>

      {error ? <p className="protocol-feedback protocol-feedback--error" role="alert">{error}</p> : null}
      {notice ? <p className="protocol-feedback protocol-feedback--success" role="status">{notice}</p> : null}

      {formOpen ? (
        <form className="protocol-form" onSubmit={saveTask}>
          <div className="protocol-form__heading">
            <h3>{draft.id ? 'Editar tarefa' : 'Nova tarefa'}</h3>
            <button type="button" className="protocol-button" onClick={() => setFormOpen(false)}>Fechar</button>
          </div>
          <label className="protocol-field protocol-field--full">Título<input autoFocus required maxLength={180} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Revisar progressão de carga" /></label>
          <label className="protocol-field">Categoria<select value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="protocol-field">Data<input type="date" required value={draft.plannedDate} onChange={event => setDraft(current => ({ ...current, plannedDate: event.target.value }))} /></label>
          <label className="protocol-field">Prioridade<select value={draft.priority} onChange={event => setDraft(current => ({ ...current, priority: event.target.value }))}>{priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="protocol-field">Status<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value }))}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="protocol-field protocol-field--wide">{personLabel} (opcional)<select value={draft.studentId} onChange={event => setDraft(current => ({ ...current, studentId: event.target.value }))}><option value="">Sem vínculo</option>{students.map(student => <option key={student.id} value={String(student.id)}>{student.name}</option>)}</select></label>
          <label className="protocol-field protocol-field--full">Observações<textarea rows="3" maxLength={3000} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Anote pontos importantes para executar este protocolo." /></label>
          <div className="protocol-form__actions">
            <button type="button" className="protocol-button" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button type="submit" className="protocol-button protocol-button--primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar tarefa'}</button>
          </div>
        </form>
      ) : null}

      <div className="protocol-task-list" aria-live="polite">
        {loading ? <p className="protocol-empty">Carregando tarefas…</p> : visibleTasks.length ? taskGroups.map(([date, dateTasks]) => (
          <section className="protocol-day-group" key={date}>
            {viewMode === 'week' ? <h3 className="protocol-day-group__heading"><span>{dayName(date)}</span><span>{formatProtocolDateKey(date)} · {dateTasks.length} {dateTasks.length === 1 ? 'tarefa' : 'tarefas'}</span></h3> : null}
            <div className="protocol-day-group__tasks">
              {dateTasks.map(task => {
                const student = students.find(item => String(item.id) === String(task.studentId))
                const isBusy = busyTaskId === String(task.id)
                return (
                  <article className={`protocol-task protocol-task--${task.status}`} key={task.id}>
                    <div className="protocol-task__main">
                      <div className="protocol-task__meta">
                        <span className={`protocol-tag protocol-tag--${task.category}`}>{optionLabel(categories, task.category)}</span>
                        <span className={`protocol-tag protocol-tag--priority-${task.priority}`}>Prioridade {optionLabel(priorities, task.priority).toLowerCase()}</span>
                        {viewMode === 'day' ? <span className="protocol-task__date">{formatProtocolDateKey(task.plannedDate)}</span> : null}
                      </div>
                      <h3>{task.title}</h3>
                      <p className="protocol-task__person">{student ? `${personLabel}: ${student.name}` : 'Sem vínculo com aluno/paciente'}</p>
                      {task.notes ? <p className="protocol-task__notes">{task.notes}</p> : null}
                    </div>
                    <div className="protocol-task__actions">
                      {task.status === 'pending' ? <button type="button" className="protocol-button" disabled={isBusy} onClick={() => updateTaskStatus(task, 'in_progress')}>Iniciar</button> : null}
                      {task.status !== 'done' && task.status !== 'canceled' ? <button type="button" className="protocol-button protocol-button--primary" disabled={isBusy} onClick={() => updateTaskStatus(task, 'done')}>Concluir</button> : null}
                      {task.status === 'done' || task.status === 'canceled' ? <button type="button" className="protocol-button" disabled={isBusy} onClick={() => updateTaskStatus(task, 'pending')}>Reabrir</button> : null}
                      <button type="button" className="protocol-button" disabled={isBusy} onClick={() => editTask(task)}>Editar</button>
                      <button type="button" className="protocol-button protocol-button--danger" disabled={isBusy} onClick={() => removeTask(task)}>{isBusy ? 'Aguarde…' : 'Excluir'}</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )) : <p className="protocol-empty">{tasks.length ? 'Nenhuma tarefa corresponde aos filtros.' : 'Nenhuma tarefa neste período. Crie a primeira para organizar seu acompanhamento.'}</p>}
      </div>
    </section>
  )
}
