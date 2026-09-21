import { useEffect } from 'react'
import { AttachmentMessage } from './AttachmentMessage'
import { ChatComposer } from './ChatComposer'
import { ChatHeader } from './ChatHeader'
import { ChatMessageList } from './ChatTimeline'

function useChatVisualViewport() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined
    const root = document.documentElement
    const viewport = window.visualViewport
    const updateHeight = () => {
      const height = Math.round(viewport?.height || window.innerHeight || 0)
      if (height > 0) root.style.setProperty('--chat-pro-visual-height', `${height}px`)
    }

    updateHeight()
    viewport?.addEventListener('resize', updateHeight)
    viewport?.addEventListener('scroll', updateHeight)
    window.addEventListener('resize', updateHeight)
    return () => {
      viewport?.removeEventListener('resize', updateHeight)
      viewport?.removeEventListener('scroll', updateHeight)
      window.removeEventListener('resize', updateHeight)
      root.style.removeProperty('--chat-pro-visual-height')
    }
  }, [])
}

export function ChatConversation({
  viewerRole,
  studentId,
  contact,
  messages = [],
  onSendMessage,
  onRetryMessage,
  onBack,
  onRefresh,
  buildPayload,
  renderActions,
  Icon,
  immersive = false,
  loading = false,
  loadError = '',
  connectionState = 'online',
  placeholder = 'Mensagem',
  className = '',
  suggestion = '',
}) {
  useChatVisualViewport()
  const ownSender = viewerRole === 'student' ? 'student' : 'coach'
  const conversationId = `${viewerRole || 'user'}:${studentId || 'conversation'}`

  return (
    <section
      className={`chat-conversation chat-pro-conversation-panel ${immersive ? 'chat-conversation-immersive chat-pro-student-shell' : ''} ${className}`.trim()}
      data-chat-role={viewerRole || 'user'}
      aria-label={`Conversa com ${contact?.name || 'contato'}`}
    >
      <ChatHeader contact={contact} onBack={onBack} Icon={Icon} />
      <ChatMessageList
        conversationId={conversationId}
        messages={messages}
        ownSender={ownSender}
        renderAttachment={(message) => <AttachmentMessage message={message} />}
        renderActions={renderActions}
        onRetryMessage={onRetryMessage}
        loading={loading}
        loadError={loadError}
        connectionState={connectionState}
        onRetryLoad={onRefresh}
      />
      <ChatComposer
        role={viewerRole}
        studentId={studentId}
        placeholder={placeholder}
        buildPayload={buildPayload}
        onSend={onSendMessage}
        Icon={Icon}
        suggestion={suggestion}
      />
    </section>
  )
}
