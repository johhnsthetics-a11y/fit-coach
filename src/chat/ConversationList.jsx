import { useMemo, useState } from 'react'

function initials(value = '') {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'AL'
}

function activityTime(value) {
  const date = new Date(value || '')
  if (!Number.isFinite(date.getTime())) return ''
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return new Intl.DateTimeFormat('pt-BR', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit' }).format(date)
}

function previewText(row) {
  if (row.latestMessage?.deletedAt) return 'Mensagem apagada'
  if (row.latestMessage?.body) return row.latestMessage.body
  if (String(row.latestMessage?.attachmentType || '').startsWith('audio/')) return 'Mensagem de áudio'
  if (row.latestMessage?.attachmentUrl) return 'Anexo enviado'
  return row.student?.lastMessage || 'Inicie uma conversa'
}

export function ConversationList({ rows = [], selectedStudentId, onSelect, Icon }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const visibleRows = useMemo(() => (
    (Array.isArray(rows) ? rows : []).filter((row) => {
      if (!normalizedQuery) return true
      const haystack = [row.student?.name, row.student?.email, row.latestMessage?.body]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
      return haystack.includes(normalizedQuery)
    })
  ), [normalizedQuery, rows])

  return (
    <aside className="chat-conversation-list chat-pro-conversations-pane" aria-label="Conversas">
      <header className="chat-list-header">
        <div>
          <p>Mensagens</p>
          <h2>Conversas</h2>
        </div>
        <span>{rows.length}</span>
      </header>
      <label className="chat-list-search">
        {Icon ? <Icon name="search" className="chat-action-icon" /> : <span aria-hidden="true">⌕</span>}
        <span className="sr-only">Buscar conversa</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno ou mensagem" />
      </label>
      <div className="chat-conversation-rows">
        {visibleRows.map((row) => {
          const studentId = String(row.student?.id ?? '')
          const selected = String(selectedStudentId ?? '') === studentId
          return (
            <button
              key={studentId}
              type="button"
              className={`chat-conversation-row ${selected ? 'chat-conversation-row-selected' : ''}`}
              data-conversation-id={studentId}
              aria-current={selected ? 'true' : undefined}
              aria-label={`Abrir conversa com ${row.student?.name || 'aluno'}`}
              onClick={() => onSelect?.(row.student)}
            >
              <span className="chat-row-avatar" aria-hidden="true">{initials(row.student?.name)}</span>
              <span className="chat-row-copy">
                <strong>{row.student?.name || 'Aluno sem nome'}</strong>
                <small>{previewText(row)}</small>
              </span>
              <span className="chat-row-meta">
                <time dateTime={row.activityAt || undefined}>{activityTime(row.activityAt)}</time>
                {row.unreadCount ? <b aria-label={`${row.unreadCount} mensagens não lidas`}>{row.unreadCount > 99 ? '99+' : row.unreadCount}</b> : null}
              </span>
            </button>
          )
        })}
        {!visibleRows.length ? (
          <div className="chat-list-empty">
            <strong>{rows.length ? 'Nenhuma conversa encontrada' : 'Nenhum aluno cadastrado'}</strong>
            <span>{rows.length ? 'Tente buscar por outro nome ou mensagem.' : 'As conversas aparecerão após o primeiro vínculo.'}</span>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
