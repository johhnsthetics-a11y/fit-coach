import { useMemo, useState } from 'react'

function normalizeLibraryText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

function isCoachCustomExercise(exercise) {
  return Boolean(exercise?.isCustom || normalizeLibraryText(exercise?.source).includes('custom'))
}

function getExerciseSourceKey(exercise = {}) {
  if (isCoachCustomExercise(exercise)) return 'custom'
  const key = normalizeLibraryText(exercise.provider || exercise.source || 'coachfit').replace(/\s+/g, '-')
  return !key || ['coachfit', 'coach-fit-pro', 'supabase'].includes(key) ? 'coachfit' : key
}

function getExerciseSourceLabel(exercise = {}) {
  if (isCoachCustomExercise(exercise)) return 'Meus exercícios'
  const raw = String(exercise.provider || exercise.source || 'coachfit').trim()
  if (!raw || ['coachfit', 'coach fit pro', 'supabase'].includes(normalizeLibraryText(raw))) return 'Coach Fit Pro'
  return raw.split(/[\s_-]+/).filter(Boolean).map((part) => part[0].toLocaleUpperCase('pt-BR') + part.slice(1)).join(' ')
}

export function getExerciseLibrarySyncCopy(sync = null, count = 0) {
  const remoteCount = Number(sync?.remoteCount) || 0
  if (sync?.status === 'ready') {
    return { tone: 'is-ready', title: 'Catálogo remoto disponível', detail: `${remoteCount} exercício${remoteCount === 1 ? '' : 's'} recebido${remoteCount === 1 ? '' : 's'} da biblioteca conectada; perfis locais também permanecem disponíveis.` }
  }
  if (sync?.status === 'empty') {
    return { tone: 'is-fallback', title: 'Biblioteca remota sem exercícios ativos', detail: `O catálogo Coach Fit Pro local continua disponível (${count} opções nesta sessão).` }
  }
  if (sync?.status === 'unavailable') {
    return { tone: 'is-fallback', title: 'Biblioteca remota indisponível', detail: `A tabela opcional não está disponível; o catálogo local continua utilizável (${count} opções nesta sessão).` }
  }
  if (sync?.status === 'error') {
    return { tone: 'is-error', title: 'Não foi possível sincronizar a biblioteca remota', detail: `A consulta falhou, mas o catálogo local permanece disponível (${count} opções nesta sessão).` }
  }
  return { tone: 'is-neutral', title: 'Catálogo desta sessão', detail: `${count} opções disponíveis entre as fontes conectadas e exercícios personalizados.` }
}

export default function TrainerExerciseLibrary({
  library = [],
  favorites = [],
  recent = [],
  selectedNames = [],
  onSelectionChange = () => {},
  onToggleFavorite = () => {},
  onPreview = () => {},
  onEditCustom = () => {},
  onDeleteCustom = () => {},
  onStartWorkout = () => {},
  syncStatus = null,
  customDraft = {},
  customFormOpen = false,
  editingName = '',
  onStartCustomExercise = () => {},
  onUpdateCustomField = () => {},
  onUpdateCustomVideoFile = () => {},
  onSaveCustomExercise = () => {},
  onCancelCustomExercise = () => {},
}) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('todos')
  const [quickFilter, setQuickFilter] = useState('all')
  const [muscleFilter, setMuscleFilter] = useState('todos')
  const [equipmentFilter, setEquipmentFilter] = useState('todos')
  const [objectiveFilter, setObjectiveFilter] = useState('todos')
  const [categoryFilter, setCategoryFilter] = useState('todos')
  const favoriteSet = useMemo(() => new Set(favorites.map(normalizeLibraryText)), [favorites])
  const recentSet = useMemo(() => new Set(recent.map(normalizeLibraryText)), [recent])

  const muscleOptions = useMemo(() => {
    const values = new Set()
    library.forEach((exercise) => {
      [exercise.group, exercise.muscleGroup, exercise.primaryMuscle, ...(Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles : [])]
        .filter(Boolean)
        .forEach((value) => values.add(String(value).trim()))
    })
    return ['todos', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))]
  }, [library])

  const equipmentOptions = useMemo(() => {
    const values = new Set(library.map((exercise) => String(exercise.equipment || '').trim()).filter(Boolean))
    return ['todos', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))]
  }, [library])

  const objectiveOptions = useMemo(() => {
    const values = new Set(library.flatMap((exercise) => [exercise.objective, exercise.goal].map((value) => String(value || '').trim()).filter(Boolean)))
    return ['todos', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))]
  }, [library])

  const categoryOptions = useMemo(() => {
    const values = new Set(library.map((exercise) => String(exercise.category || '').trim()).filter(Boolean))
    return ['todos', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))]
  }, [library])

  const sourceOptions = useMemo(() => {
    const values = new Map()
    library.forEach((exercise) => values.set(getExerciseSourceKey(exercise), getExerciseSourceLabel(exercise)))
    return Array.from(values, ([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
  }, [library])

  const results = useMemo(() => {
    const query = normalizeLibraryText(search)
    const tokens = query.split(/\s+/).filter(Boolean)
    return library
      .filter((exercise) => {
        const nameKey = normalizeLibraryText(exercise.name)
        const searchText = normalizeLibraryText([
          exercise.name,
          exercise.group,
          exercise.muscleGroup,
          exercise.primaryMuscle,
          exercise.equipment,
          exercise.objective,
          exercise.goal,
          exercise.category,
          exercise.instructions,
          exercise.cues,
          exercise.source,
          exercise.provider,
          ...(Array.isArray(exercise.aliases) ? exercise.aliases : []),
          ...(Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles : []),
        ].filter(Boolean).join(' '))
        const muscleValues = [exercise.group, exercise.muscleGroup, exercise.primaryMuscle, ...(Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles : [])]
          .filter(Boolean)
          .map(normalizeLibraryText)
        const isFavorite = favoriteSet.has(nameKey)
        const isRecent = recentSet.has(nameKey)
        const isCustom = isCoachCustomExercise(exercise)
        if (tokens.length && !tokens.every((token) => searchText.includes(token))) return false
        if (muscleFilter !== 'todos' && !muscleValues.includes(normalizeLibraryText(muscleFilter))) return false
        if (equipmentFilter !== 'todos' && normalizeLibraryText(exercise.equipment) !== normalizeLibraryText(equipmentFilter)) return false
        const objectiveValues = [exercise.objective, exercise.goal].filter(Boolean).map(normalizeLibraryText)
        if (objectiveFilter !== 'todos' && !objectiveValues.includes(normalizeLibraryText(objectiveFilter))) return false
        if (categoryFilter !== 'todos' && normalizeLibraryText(exercise.category) !== normalizeLibraryText(categoryFilter)) return false
        if (quickFilter === 'favorites' && !isFavorite) return false
        if (quickFilter === 'recent' && !isRecent) return false
        if (quickFilter === 'custom' && !isCustom) return false
        if (sourceFilter !== 'todos' && getExerciseSourceKey(exercise) !== sourceFilter) return false
        return true
      })
      .map((exercise, index) => ({ exercise, index }))
      .sort((left, right) => {
        if (!tokens.length) return left.index - right.index
        const score = (exercise) => {
          const name = normalizeLibraryText(exercise.name)
          const text = normalizeLibraryText([exercise.name, exercise.group, exercise.muscleGroup, exercise.primaryMuscle, exercise.equipment, exercise.objective, exercise.goal, ...(Array.isArray(exercise.aliases) ? exercise.aliases : [])].filter(Boolean).join(' '))
          return (name === query ? 120 : 0)
            + (name.startsWith(query) ? 70 : 0)
            + (name.includes(query) ? 45 : 0)
            + (favoriteSet.has(name) ? 8 : 0)
            + (recentSet.has(name) ? 5 : 0)
            + (text.includes(query) ? 12 : 0)
        }
        return score(right.exercise) - score(left.exercise) || left.index - right.index
      })
      .map(({ exercise }) => ({
        ...exercise,
        isFavorite: favoriteSet.has(normalizeLibraryText(exercise.name)),
        isRecent: recentSet.has(normalizeLibraryText(exercise.name)),
      }))
  }, [categoryFilter, equipmentFilter, favoriteSet, library, muscleFilter, objectiveFilter, quickFilter, recentSet, search, sourceFilter])

  const syncCopy = getExerciseLibrarySyncCopy(syncStatus, library.length)
  const uniqueSelected = selectedNames.filter((name, index, names) => names.findIndex((item) => normalizeLibraryText(item) === normalizeLibraryText(name)) === index)

  function toggleSelection(name) {
    const key = normalizeLibraryText(name)
    onSelectionChange((current) => current.some((item) => normalizeLibraryText(item) === key)
      ? current.filter((item) => normalizeLibraryText(item) !== key)
      : [...current, name])
  }

  function clearFilters() {
    setSearch('')
    setSourceFilter('todos')
    setQuickFilter('all')
    setMuscleFilter('todos')
    setEquipmentFilter('todos')
    setObjectiveFilter('todos')
    setCategoryFilter('todos')
  }

  return (
    <section className="trainer-exercise-library" aria-label="Biblioteca de exercícios">
      <header className="trainer-library-heading">
        <div>
          <p>EXERCÍCIOS</p>
          <h3>Biblioteca de movimentos</h3>
          <span>Explore primeiro. A seleção vira um novo rascunho e não publica nem altera um plano existente.</span>
        </div>
        <button type="button" className="trainer-library-create-button" onClick={onStartCustomExercise}>
          Criar exercício
        </button>
      </header>

      <div className={`trainer-library-sync ${syncCopy.tone}`} role="status">
        <span className="trainer-library-sync-indicator" aria-hidden="true" />
        <div><strong>{syncCopy.title}</strong><small>{syncCopy.detail}</small></div>
      </div>

      <div className="trainer-library-controls">
        <label className="trainer-library-search">
          <span>Buscar exercício</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, músculo, equipamento ou instrução" />
        </label>
        <div className="trainer-library-shortcuts" role="group" aria-label="Acesso rápido à biblioteca">
          <span className="trainer-library-source-label">ACESSO RÁPIDO</span>
          {[
            ['all', 'Todos'],
            ['favorites', 'Favoritos'],
            ['recent', 'Recentes'],
            ['custom', 'Meus exercícios'],
          ].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={quickFilter === value} className={quickFilter === value ? 'is-active' : ''} onClick={() => setQuickFilter(value)}>{label}</button>
          ))}
        </div>
        <div className="trainer-library-filters">
          <label>Grupo muscular
            <select value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)}>
              {muscleOptions.map((value) => <option key={value} value={value}>{value === 'todos' ? 'Todos os grupos' : value}</option>)}
            </select>
          </label>
          <label>Equipamento
            <select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}>
              {equipmentOptions.map((value) => <option key={value} value={value}>{value === 'todos' ? 'Todos os equipamentos' : value}</option>)}
            </select>
          </label>
          <label>Objetivo
            <select value={objectiveFilter} onChange={(event) => setObjectiveFilter(event.target.value)}>
              {objectiveOptions.map((value) => <option key={value} value={value}>{value === 'todos' ? 'Todos os objetivos' : value}</option>)}
            </select>
          </label>
          <label>Categoria
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {categoryOptions.map((value) => <option key={value} value={value}>{value === 'todos' ? 'Todas as categorias' : value}</option>)}
            </select>
          </label>
          <label>Origem
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="todos">Todas as fontes</option>
              {sourceOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="button" className="trainer-library-clear" onClick={clearFilters}>Limpar filtros</button>
        </div>
      </div>

      {customFormOpen ? (
        <form className="trainer-library-custom-form" onSubmit={(event) => { event.preventDefault(); onSaveCustomExercise() }}>
          <div className="trainer-library-custom-heading">
            <div><p>EXERCÍCIO PERSONALIZADO</p><h4>{editingName ? 'Editar exercício da biblioteca' : 'Novo exercício'}</h4></div>
            <button type="button" onClick={onCancelCustomExercise}>Cancelar</button>
          </div>
          <div className="trainer-library-custom-fields">
            <label>Nome<input value={customDraft.name || ''} onChange={(event) => onUpdateCustomField('name', event.target.value)} placeholder="Ex.: Supino com pausa" /></label>
            <label>Grupo muscular<input value={customDraft.muscleGroup || customDraft.group || ''} onChange={(event) => onUpdateCustomField('muscleGroup', event.target.value)} placeholder="Peitoral" /></label>
            <label>Equipamento<input value={customDraft.equipment || ''} onChange={(event) => onUpdateCustomField('equipment', event.target.value)} placeholder="Barra, halter..." /></label>
            <label>Objetivo<input value={customDraft.objective || ''} onChange={(event) => onUpdateCustomField('objective', event.target.value)} placeholder="Força, mobilidade..." /></label>
            <label>Categoria<input value={customDraft.category || ''} onChange={(event) => onUpdateCustomField('category', event.target.value)} placeholder="Força, máquina..." /></label>
            <label>Nível<input value={customDraft.level || ''} onChange={(event) => onUpdateCustomField('level', event.target.value)} placeholder="Iniciante, intermediário..." /></label>
            <label>Tipo<input value={customDraft.composition || ''} onChange={(event) => onUpdateCustomField('composition', event.target.value)} placeholder="Composto, isolado..." /></label>
          </div>
          <label className="trainer-library-custom-instructions">Instruções<textarea value={customDraft.instructions || ''} onChange={(event) => onUpdateCustomField('instructions', event.target.value)} rows={3} placeholder="Dica curta de execução." /></label>
          <label className="trainer-library-custom-video">Vídeo do exercício
            <input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" capture="environment" onChange={(event) => onUpdateCustomVideoFile(event.target.files?.[0] || null)} />
            <span>{customDraft.videoFileName || 'Grave agora ou escolha da galeria.'}</span>
          </label>
          <p className="trainer-library-media-note">Um arquivo local não fica guardado como vídeo sincronizado na biblioteca depois de fechar ou recarregar. O envio durável segue o fluxo existente de salvar o treino.</p>
          <button type="submit" className="trainer-library-create-button">{editingName ? 'Salvar alterações na biblioteca' : 'Salvar na biblioteca'}</button>
        </form>
      ) : null}

      <div className="trainer-library-workspace">
        <div className="trainer-library-results" aria-live="polite">
          <div className="trainer-library-results-heading"><strong>{results.length} exercício{results.length === 1 ? '' : 's'}</strong><span>Seleção mantida ao trocar filtros</span></div>
          {results.length ? results.map((exercise) => {
            const selected = uniqueSelected.some((name) => normalizeLibraryText(name) === normalizeLibraryText(exercise.name))
            const custom = isCoachCustomExercise(exercise)
            return (
              <article key={exercise.name} className={`trainer-library-item ${selected ? 'is-selected' : ''}`}>
                <div className="trainer-library-item-copy">
                  <strong>{exercise.name || 'Exercício sem nome'}</strong>
                  <span>{exercise.group || exercise.muscleGroup || exercise.primaryMuscle || 'Grupo muscular não informado'}{exercise.equipment ? ` · ${exercise.equipment}` : ''}</span>
                  <small>{[exercise.objective || exercise.goal, exercise.category, exercise.isFavorite ? 'Favorito' : '', exercise.isRecent ? 'Usado recentemente' : '', getExerciseSourceLabel(exercise)].filter(Boolean).join(' · ')}</small>
                </div>
                <div className="trainer-library-item-actions">
                  <button type="button" aria-label={exercise.isFavorite ? `Remover ${exercise.name} dos favoritos` : `Favoritar ${exercise.name}`} aria-pressed={Boolean(exercise.isFavorite)} onClick={() => onToggleFavorite(exercise.name)}>{exercise.isFavorite ? 'Favorito' : 'Favoritar'}</button>
                  <button type="button" onClick={() => onPreview(exercise)}>Ver ficha</button>
                  {custom ? <button type="button" onClick={() => onEditCustom(exercise)}>Editar</button> : null}
                  {custom ? <button type="button" onClick={() => onDeleteCustom(exercise)}>Excluir</button> : null}
                  <button type="button" className="trainer-library-select" aria-pressed={selected} onClick={() => toggleSelection(exercise.name)}>{selected ? 'Selecionado' : 'Selecionar'}</button>
                </div>
              </article>
            )
          }) : (
            <div className="trainer-library-empty">
              <strong>{library.length ? 'Nenhum exercício corresponde a esta busca.' : 'Nenhum exercício disponível nesta sessão.'}</strong>
              <span>{library.length ? 'Ajuste ou limpe os filtros; suas seleções anteriores continuam preservadas.' : 'Confira a conexão da biblioteca remota ou crie um exercício próprio. O app não altera os dados do aluno.'}</span>
              <button type="button" onClick={clearFilters}>Limpar filtros</button>
            </div>
          )}
        </div>

        <aside className="trainer-library-selection" aria-label="Seleção para nova prescrição">
          <div><p>NOVA PRESCRIÇÃO</p><h4>{uniqueSelected.length} selecionado{uniqueSelected.length === 1 ? '' : 's'}</h4><span>Escolha exercícios e continue no editor para definir aluno, dias e parâmetros.</span></div>
          {uniqueSelected.length ? (
            <ol>{uniqueSelected.map((name, index) => <li key={`${normalizeLibraryText(name)}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{name}</strong><button type="button" aria-label={`Remover ${name} da seleção`} onClick={() => toggleSelection(name)}>Remover</button></li>)}</ol>
          ) : <p className="trainer-library-selection-empty">Selecione um ou mais exercícios. A busca e os filtros não apagam esta seleção.</p>}
          <button type="button" className="trainer-library-create-button" disabled={!uniqueSelected.length} onClick={() => onStartWorkout(uniqueSelected)}>Continuar para montagem do treino</button>
          <small>Para adicionar a um plano existente, abra o dia no editor e use “Adicionar exercício”.</small>
        </aside>
      </div>
    </section>
  )
}
