import { useEffect, useState } from 'react'

const REASONS = [
  ['harassment', 'Assédio ou ofensas'],
  ['spam', 'Spam ou mensagens indesejadas'],
  ['sexual_content', 'Conteúdo sexual inadequado'],
  ['privacy', 'Exposição de informações pessoais'],
  ['hate_or_abuse', 'Discriminação ou ameaças'],
  ['other', 'Outro motivo'],
]

export function ChatSafetyMenu({ busy, phase, blockedByYou, onReportContact, onToggleBlock }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!open) return undefined
    const close = event => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  return (
    <div className="chat-safety-menu">
      <button type="button" aria-label="Segurança da conversa" aria-haspopup="menu"
        aria-expanded={open} title="Segurança e privacidade"
        className="chat-safety-menu-trigger" onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true">⋮</span>
      </button>
      {open ? (
        <div className="chat-safety-dropdown" role="menu" aria-label="Segurança da conversa">
          <button type="button" role="menuitem" disabled={phase !== 'ready' || busy}
            onClick={() => { setOpen(false); onReportContact?.() }}>
            Denunciar contato
          </button>
          <button type="button" role="menuitem" disabled={phase !== 'ready' || busy}
            className={!blockedByYou ? 'chat-safety-danger' : ''}
            onClick={() => { setOpen(false); onToggleBlock?.() }}>
            {blockedByYou ? 'Desbloquear conversa' : 'Bloquear conversa'}
          </button>
          <p>O bloqueio impede novas mensagens, mas preserva treinos, dietas e histórico.</p>
        </div>
      ) : null}
    </div>
  )
}

export function ChatSafetyReportDialog({ target, onClose, onSend }) {
  const [reason, setReason] = useState('harassment')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const onEscape = event => { if (event.key === 'Escape' && !submitting) onClose?.() }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [onClose, submitting])

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onSend({ reason, details: details.trim(), messageId: target?.messageId || null })
      onClose?.()
    } catch (failure) {
      setError(failure?.message || 'Não foi possível enviar a denúncia. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="chat-safety-overlay">
      <section role="dialog" aria-modal="true" aria-labelledby="chat-safety-report-title" className="chat-safety-dialog">
        <header>
          <h3 id="chat-safety-report-title">{target?.messageId ? 'Denunciar mensagem' : 'Denunciar contato'}</h3>
          <button type="button" aria-label="Fechar denúncia" disabled={submitting} onClick={onClose}>×</button>
        </header>
        <p>Envie a denúncia de forma confidencial para análise pela equipe do Coach Fit Pro.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="chat-report-reason">Motivo</label>
          <select id="chat-report-reason" required value={reason} onChange={e => setReason(e.target.value)} disabled={submitting}>
            {REASONS.map(([value,label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <label htmlFor="chat-report-details">Descrição (opcional)</label>
          <textarea id="chat-report-details" rows={3} maxLength={500} value={details}
            onChange={e => setDetails(e.target.value)} disabled={submitting}
            placeholder="Descreva o ocorrido, sem incluir senhas ou dados sensíveis." />
          <span className="chat-safety-count">{details.length}/500</span>
          {error ? <p role="alert" className="chat-safety-error">{error}</p> : null}
          <footer>
            <button type="button" className="chat-safety-cancel" disabled={submitting} onClick={onClose}>Cancelar</button>
            <button type="submit" className="chat-safety-submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar denúncia'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
