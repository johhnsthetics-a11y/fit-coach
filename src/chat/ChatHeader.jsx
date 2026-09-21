function getInitials(value = '') {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'CF'
}

export function ChatHeader({ contact = {}, onBack, Icon, actions }) {
  const name = String(contact.name || 'Conversa')
  const subtitle = String(contact.subtitle || 'Acompanhamento pelo Coach Fit Pro')

  return (
    <header className="chat-header chat-pro-header">
      {onBack ? (
        <button type="button" className="chat-header-back" onClick={onBack} aria-label="Voltar" title="Voltar">
          {Icon ? <Icon name="arrowLeft" className="chat-action-icon" /> : <span aria-hidden="true">‹</span>}
        </button>
      ) : null}
      <div className="chat-contact-avatar" aria-hidden="true">
        {contact.avatarUrl
          ? <img src={contact.avatarUrl} alt="" />
          : <span>{getInitials(name)}</span>}
      </div>
      <div className="chat-contact-copy">
        <h2>{name}</h2>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="chat-header-actions">{actions}</div> : null}
    </header>
  )
}
