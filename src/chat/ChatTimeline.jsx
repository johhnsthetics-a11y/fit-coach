import { useMemo } from 'react'
import { buildChatTimeline } from './chatModel'
import { useChatViewport } from './useChatViewport'

function formatChatTime(value) {
  const date = new Date(value ?? '')
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function deliveryLabel(message, own) {
  if (!own) return ''
  if (message?.deliveryState === 'sending') return 'Enviando'
  if (message?.deliveryState === 'failed') return 'Falha no envio'
  return 'Enviada'
}

export function DateSeparator({ label }) {
  return (
    <div className="chat-date-separator" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  )
}

export function EmptyChatState({ text = 'Inicie a conversa' }) {
  return (
    <div className="chat-empty-state">
      <strong>{text}</strong>
      <span>As mensagens desta conversa aparecerão aqui.</span>
    </div>
  )
}

export function ChatLoadState({ loading = false, loadError = '', connectionState = 'online', onRetryLoad }) {
  if (loading) {
    return (
      <div className="chat-loading-state" aria-label="Carregando mensagens" aria-busy="true">
        <span /><span /><span />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="chat-load-error" role="alert">
        <span>Não foi possível carregar as mensagens.</span>
        {onRetryLoad ? <button type="button" onClick={onRetryLoad}>Tentar novamente</button> : null}
      </div>
    )
  }

  if (connectionState === 'unstable') {
    return <div className="chat-connection-state" role="status">Conexão instável. Tentando sincronizar...</div>
  }

  return null
}

export function MessageBubble({ message, own = false, isFirst = true, isLast = true, renderAttachment, renderActions, onRetryMessage }) {
  const status = deliveryLabel(message, own)
  const time = formatChatTime(message?.createdAt)

  return (
    <article
      className={`chat-message-bubble ${own ? 'chat-message-own' : 'chat-message-received'} ${isFirst ? 'chat-group-first' : ''} ${isLast ? 'chat-group-last' : ''}`}
      data-message-id={message?.id || undefined}
      data-delivery-state={message?.deliveryState || 'sent'}
    >
      {message?.deletedAt ? (
        <p className="chat-message-deleted">Mensagem apagada</p>
      ) : (
        <>
          {message?.body ? <p className="chat-message-body">{message.body}</p> : null}
          {renderAttachment?.(message)}
        </>
      )}
      <footer className="chat-message-meta">
        {time ? <time dateTime={message?.createdAt}>{time}</time> : null}
        {status ? <span className={`chat-delivery chat-delivery-${message?.deliveryState || 'sent'}`}>{status}</span> : null}
      </footer>
      {own && message?.deliveryState === 'failed' && onRetryMessage ? (
        <button type="button" className="chat-message-retry" onClick={() => Promise.resolve().then(() => onRetryMessage(message)).catch(() => undefined)}>
          Tentar novamente
        </button>
      ) : null}
      {renderActions?.(message)}
    </article>
  )
}

export function NewMessagesIndicator({ count = 0, onClick }) {
  if (!count) return null
  return (
    <button type="button" className="chat-new-messages" onClick={onClick} aria-label={`Ir para ${count} ${count === 1 ? 'nova mensagem' : 'novas mensagens'}`}>
      <span aria-hidden="true">↓</span>
      {count === 1 ? '1 nova mensagem' : `${count} novas mensagens`}
    </button>
  )
}

export function ChatMessageList({
  conversationId = '',
  messages = [],
  ownSender,
  renderAttachment,
  renderActions,
  emptyText = 'Inicie a conversa',
  loading = false,
  loadError = '',
  connectionState = 'online',
  onRetryLoad,
  onRetryMessage,
}) {
  const safeMessages = Array.isArray(messages) ? messages : []
  const timeline = useMemo(() => buildChatTimeline(safeMessages), [safeMessages])
  const {
    viewportRef,
    bottomRef,
    contentRef,
    unseenCount,
    onScroll,
    scrollToBottom,
  } = useChatViewport({ conversationId, messageCount: safeMessages.length })

  return (
    <div className="chat-message-region">
      <ChatLoadState loading={loading && !safeMessages.length} loadError={loadError && !safeMessages.length ? loadError : ''} connectionState={connectionState} onRetryLoad={onRetryLoad} />
      <div ref={viewportRef} className="chat-message-list chat-pro-viewport" role="log" aria-live="polite" aria-relevant="additions text" onScroll={onScroll}>
        <div ref={contentRef} className="chat-message-content">
          {!loading && !loadError && !timeline.length ? <EmptyChatState text={emptyText} /> : null}
          {timeline.map((item) => (
            item.kind === 'date'
              ? <DateSeparator key={item.key} label={item.label} />
              : (
                <MessageBubble
                  key={item.key}
                  message={item.message}
                  own={item.message?.sender === ownSender}
                  isFirst={item.isFirst}
                  isLast={item.isLast}
                  renderAttachment={renderAttachment}
                  renderActions={renderActions}
                  onRetryMessage={onRetryMessage}
                />
              )
          ))}
          <div ref={bottomRef} className="chat-bottom-anchor" aria-hidden="true" />
        </div>
      </div>
      <NewMessagesIndicator count={unseenCount} onClick={() => scrollToBottom('smooth')} />
    </div>
  )
}
