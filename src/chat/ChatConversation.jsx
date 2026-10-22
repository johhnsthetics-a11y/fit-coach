import { useEffect } from 'react'
import { AttachmentMessage } from './AttachmentMessage'
import { ChatComposer } from './ChatComposer'
import { ChatHeader } from './ChatHeader'
import { ChatMessageList } from './ChatTimeline'
import { getChatViewportMetrics } from './chatViewportModel'

function useChatVisualViewport() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined
    const root = document.documentElement
    const viewport = window.visualViewport
    let frameId = 0
    let settleTimer = 0
    let baselineHeight = Math.max(
      Number(window.innerHeight) || 0,
      (Number(viewport?.height) || 0) + Math.max(Number(viewport?.offsetTop) || 0, 0),
    )

    const hasTextInputFocus = () => {
      const active = document.activeElement
      if (!active) return false
      return active.matches?.('textarea, input:not([type="button"]):not([type="submit"]):not([type="file"]), [contenteditable="true"]') || false
    }

    const applyMetrics = () => {
      frameId = 0
      const visualExtent = (Number(viewport?.height) || 0) + Math.max(Number(viewport?.offsetTop) || 0, 0)
      if (!hasTextInputFocus()) baselineHeight = Math.max(Number(window.innerHeight) || 0, visualExtent)
      const { height, offsetTop, keyboardHeight, keyboardOpen } = getChatViewportMetrics({
        visualViewport: viewport,
        innerHeight: window.innerHeight,
        baselineHeight,
      })

      if (height > 0) root.style.setProperty('--chat-pro-visual-height', `${height}px`)
      root.style.setProperty('--chat-pro-visual-offset-top', `${offsetTop}px`)
      root.style.setProperty('--chat-pro-keyboard-height', `${keyboardHeight}px`)
      root.classList.toggle('chat-keyboard-open', keyboardOpen)
    }

    const updateMetrics = () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(applyMetrics)
    }

    const updateAfterKeyboardTransition = () => {
      updateMetrics()
      if (settleTimer) window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(updateMetrics, 320)
    }

    applyMetrics()
    viewport?.addEventListener('resize', updateMetrics)
    viewport?.addEventListener('scroll', updateMetrics)
    window.addEventListener('resize', updateMetrics)
    document.addEventListener('focusin', updateAfterKeyboardTransition)
    document.addEventListener('focusout', updateAfterKeyboardTransition)
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      if (settleTimer) window.clearTimeout(settleTimer)
      viewport?.removeEventListener('resize', updateMetrics)
      viewport?.removeEventListener('scroll', updateMetrics)
      window.removeEventListener('resize', updateMetrics)
      document.removeEventListener('focusin', updateAfterKeyboardTransition)
      document.removeEventListener('focusout', updateAfterKeyboardTransition)
      root.style.removeProperty('--chat-pro-visual-height')
      root.style.removeProperty('--chat-pro-visual-offset-top')
      root.style.removeProperty('--chat-pro-keyboard-height')
      root.classList.remove('chat-keyboard-open')
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
  const wallpaperAction = (
    <button
      type="button"
      className="chat-wallpaper-native-trigger"
      aria-label="Escolher plano de fundo do chat"
      title="Personalizar conversa"
      onClick={() => document.dispatchEvent(new CustomEvent('coach-fit:open-chat-wallpaper'))}
    >
      {Icon
        ? <Icon name="settings" className="chat-wallpaper-native-icon" />
        : <span className="chat-wallpaper-native-fallback-icon" aria-hidden="true" />}
      <span className="chat-wallpaper-native-copy">
        <strong>Personalizar</strong>
        <small className="chat-wallpaper-native-current">Aurora</small>
      </span>
      <span className="chat-wallpaper-native-indicator" aria-hidden="true" />
    </button>
  )

  return (
    <section
      className={`chat-conversation chat-pro-conversation-panel ${immersive ? 'chat-conversation-immersive chat-pro-student-shell' : ''} ${className}`.trim()}
      data-chat-role={viewerRole || 'user'}
      aria-label={`Conversa com ${contact?.name || 'contato'}`}
    >
      <ChatHeader contact={contact} onBack={onBack} Icon={Icon} actions={wallpaperAction} />
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
