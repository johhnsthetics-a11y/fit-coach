import { useEffect, useCallback, useState } from 'react'
import { useChatSafety } from './useChatSafety'
import { ChatSafetyMenu, ChatSafetyReportDialog } from './ChatSafetyControls'
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
  inviteCode = '',
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
  const safety = useChatSafety({ studentId, viewerRole, inviteCode })
  const [reportTarget, setReportTarget] = useState(null)
  const [safetyNotice, setSafetyNotice] = useState('')
  useEffect(() => { setReportTarget(null); setSafetyNotice('') }, [studentId, inviteCode, viewerRole])
  const sendingDisabled = safety.enabled && (safety.phase !== 'ready' || safety.blocked || safety.busy)

  const guardedSend = useCallback(async (payload) => {
    if (safety.enabled && (safety.phase !== 'ready' || safety.blocked)) {
      throw new Error('A comunicação está bloqueada ou ainda está sendo verificada.')
    }
    try {
      return await onSendMessage?.(payload)
    } catch (error) {
      // Server-side block triggers also stop in-flight attachment uploads /
      // messages. Refresh the UI after a rejected send without hiding its error.
      if (safety.enabled) safety.refresh().catch(() => undefined)
      throw error
    }
  }, [onSendMessage, safety.enabled, safety.phase, safety.blocked, safety.refresh])

  const guardedRetry = useCallback(async (message) => {
    if (safety.enabled && (safety.phase !== 'ready' || safety.blocked)) {
      throw new Error('Conversa bloqueada.')
    }
    return onRetryMessage?.(message)
  }, [onRetryMessage, safety.enabled, safety.phase, safety.blocked])

  async function toggleBlock() {
    const next = !safety.blockedByYou
    if (next && !window.confirm('Bloquear novas mensagens nesta conversa? Treinos, dietas e registros permanecerão disponíveis.')) return
    setSafetyNotice('')
    try {
      await safety.setBlocked(next)
      setSafetyNotice(next ? 'Conversa bloqueada. O histórico foi preservado.' : 'Conversa desbloqueada.')
    } catch (error) {
      setSafetyNotice(error?.message || 'Não foi possível atualizar o bloqueio.')
    }
  }

  async function submitReport(payload) {
    await safety.report(payload)
    setSafetyNotice('Denúncia enviada para análise confidencial.')
  }

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
      <ChatHeader contact={contact} onBack={onBack} Icon={Icon} actions={(
        <>
          {wallpaperAction}
          {safety.enabled ? (
            <ChatSafetyMenu
              phase={safety.phase}
              busy={safety.busy}
              blockedByYou={safety.blockedByYou}
              onReportContact={() => setReportTarget({})}
              onToggleBlock={toggleBlock}
            />
          ) : null}
        </>
      )} />
      {safety.enabled && safety.phase === 'loading' ? (
        <div className="chat-safety-banner" role="status">Verificando a segurança da conversa...</div>
      ) : null}
      {safety.enabled && safety.phase === 'error' ? (
        <div className="chat-safety-banner chat-safety-banner-error" role="alert">
          Não foi possível verificar o bloqueio. O envio está temporariamente desativado.
          <button type="button" onClick={() => safety.refresh().catch(() => undefined)}>Tentar novamente</button>
        </div>
      ) : null}
      {safety.enabled && safety.phase === 'ready' && safety.blocked ? (
        <div className="chat-safety-banner" role="status">
          {safety.blockedByYou ? 'Você bloqueou esta conversa.' : 'A outra pessoa bloqueou esta conversa.'} O histórico permanece disponível.
          {safety.blockedByYou ? <button type="button" disabled={safety.busy} onClick={toggleBlock}>Desbloquear</button> : null}
        </div>
      ) : null}
      {safetyNotice ? <p className="chat-safety-notice" role="status">{safetyNotice}</p> : null}
      <ChatMessageList
        conversationId={conversationId}
        messages={messages}
        ownSender={ownSender}
        renderAttachment={(message) => <AttachmentMessage message={message} />}
        renderActions={renderActions}
        onReportMessage={safety.enabled && safety.phase === 'ready'
          ? (message) => setReportTarget({ messageId: message.id }) : null}
        onRetryMessage={sendingDisabled ? null : guardedRetry}
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
        onSend={guardedSend}
        disabled={sendingDisabled}
        Icon={Icon}
        suggestion={suggestion}
      />
      {reportTarget !== null ? (
        <ChatSafetyReportDialog key={reportTarget.messageId || 'contact'} target={reportTarget}
          onClose={() => setReportTarget(null)} onSend={submitReport} />
      ) : null}
    </section>
  )
}
