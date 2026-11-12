import './professional-delegated-workout-build41.css'

const asList = (value) => (Array.isArray(value) ? value : [])
const text = (value, fallback = '') => (value == null || value === '' ? fallback : String(value))

function initials(name) {
  return text(name, 'Paciente')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toLocaleUpperCase('pt-BR')
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}

export default function ProfessionalDelegatedWorkoutReadOnly({ entries = [], uiTheme = 'dark', loading = false }) {
  const theme = uiTheme === 'light' ? 'light' : 'dark'
  const rows = asList(entries)

  return (
    <section className="pdr-workspace" data-theme={theme} aria-labelledby="pdr-title">
      <header className="pdr-header">
        <div>
          <p className="pdr-eyebrow">Colaboração profissional · modo leitura</p>
          <h2 id="pdr-title">Treinos compartilhados</h2>
          <p>Você acompanha somente os treinos de pacientes que autorizaram a colaboração nesta equipe.</p>
        </div>
        <span className="pdr-readonly-pill" aria-label="Somente leitura">Somente leitura</span>
      </header>

      <aside className="pdr-scope-note">
        <span className="pdr-scope-icon" aria-hidden="true">✓</span>
        <p><strong>Escopo protegido.</strong> A carteira continua com o profissional responsável. Esta visualização não inclui conversas, questionários, outras áreas ou informações financeiras.</p>
      </aside>

      {loading ? <p className="pdr-state" role="status">Carregando pacientes autorizados…</p> : null}
      {!loading && !rows.length ? <p className="pdr-state">Não há treinos compartilhados ativos para mostrar.</p> : null}

      <div className="pdr-student-list">
        {rows.map((entry) => {
          const student = entry?.student || {}
          const workouts = asList(entry?.workouts).filter((workout) => workout?.publicationStatus !== 'archived' && workout?.active !== false)
          const logs = asList(entry?.workoutLogs)
          return (
            <article className="pdr-student-card" key={`${entry?.delegationId || student.id || student.name}`}>
              <header className="pdr-student-head">
                <span className="pdr-avatar" aria-hidden="true">{initials(student.name)}</span>
                <div className="pdr-student-copy">
                  <h3>{text(student.name, 'Paciente')}</h3>
                  <p>{[student.goal, student.phase].filter(Boolean).join(' · ') || 'Acompanhamento compartilhado'}</p>
                </div>
                <span className="pdr-permission">Consentimento ativo</span>
              </header>

              {workouts.length ? (
                <div className="pdr-workout-list">
                  {workouts.map((workout) => {
                    const exercises = asList(workout?.exercises)
                    const published = workout?.publicationStatus === 'published' || workout?.active === true
                    return (
                      <section className="pdr-workout" key={workout.id || workout.title}>
                        <div className="pdr-workout-heading">
                          <div>
                            <span className={`pdr-status ${published ? 'is-published' : 'is-draft'}`}>{published ? 'Publicado' : text(workout?.status, 'Em preparação')}</span>
                            <h4>{text(workout?.title, 'Treino')}</h4>
                            {workout?.focus ? <p>{workout.focus}</p> : null}
                            <p className="pdr-byline">Elaborado por {text(workout?.createdByName, 'Treinador colaborador')}{workout?.updatedByName && workout.updatedByName !== workout.createdByName ? ` · atualizado por ${workout.updatedByName}` : ''}</p>
                          </div>
                          <span className="pdr-exercise-count">{exercises.length} {exercises.length === 1 ? 'exercício' : 'exercícios'}</span>
                        </div>
                        {workout?.frequency ? <p className="pdr-frequency">Frequência: {workout.frequency}</p> : null}
                        {exercises.length ? (
                          <ol className="pdr-exercise-list">
                            {exercises.map((exercise, index) => (
                              <li key={exercise.id || `${exercise.name}-${index}`}>
                                <span className="pdr-exercise-number">{String(index + 1).padStart(2, '0')}</span>
                                <span className="pdr-exercise-name">{text(exercise.name, 'Exercício')}</span>
                                <span className="pdr-exercise-dose">{[exercise.sets && `${exercise.sets} séries`, exercise.reps && `${exercise.reps} reps`].filter(Boolean).join(' · ') || 'Prescrição não informada'}</span>
                              </li>
                            ))}
                          </ol>
                        ) : <p className="pdr-muted">Este treino não tem exercícios registrados.</p>}
                      </section>
                    )
                  })}
                </div>
              ) : <p className="pdr-muted pdr-no-workout">Nenhum treino ativo está associado a este paciente no momento.</p>}

              <footer className="pdr-student-footer">
                <span>{logs.length} {logs.length === 1 ? 'sessão registrada' : 'sessões registradas'}</span>
                {logs[0]?.completedAt || logs[0]?.completed_at ? <span>Última atividade: {formatDate(logs[0].completedAt || logs[0].completed_at)}</span> : null}
              </footer>
            </article>
          )
        })}
      </div>
    </section>
  )
}
