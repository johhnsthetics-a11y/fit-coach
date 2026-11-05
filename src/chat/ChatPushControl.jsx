import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  enableChatPushForConversation,
  getChatPushPermissionState,
  isNativeIosPushAvailable,
} from './chatPushNotifications'

export function ChatPushControl({ viewerRole, studentId, inviteCode = '', Icon }) {
  const actorType = viewerRole === 'student' ? 'student' : 'coach'
  const context = useMemo(() => ({
    actorType,
    studentId: actorType === 'student' ? studentId : '',
    inviteCode: actorType === 'student' ? inviteCode : '',
  }), [actorType, inviteCode, studentId])
  const [state, setState] = useState('checking')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  const syncPermission = useCallback(async (requestPermission) => {
    setBusy(true)
    setFeedback('')
    try {
      const result = await enableChatPushForConversation(context, { requestPermission })
      if (result.ok) {
        setState('enabled')
        setFeedback('Avisos de novas mensagens ativados neste dispositivo.')
      } else if (result.reason === 'denied') {
        setState('denied')
        setFeedback('Ative as notificações do Coach Fit Pro nos Ajustes do iPhone.')
      } else if (result.reason === 'permission') {
        setState('prompt')
        setFeedback('Permita notificações para receber mensagens neste dispositivo.')
      } else {
        setState('error')
        setFeedback('Não foi possível ativar os avisos agora. Tente novamente.')
      }
    } catch {
      setState('error')
      setFeedback('Não foi possível ativar os avisos agora. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }, [context])

  useEffect(() => {
    let active = true
    if (!isNativeIosPushAvailable()) {
      setState('hidden')
      return () => { active = false }
    }
    getChatPushPermissionState(context)
      .then((result) => {
        if (!active) return
        if (!result.available) {
          setState('hidden')
          return
        }
        if (result.permission === 'granted') {
          syncPermission(false)
          return
        }
        setState(result.permission === 'denied' ? 'denied' : 'prompt')
      })
      .catch(() => { if (active) setState('hidden') })
    return () => { active = false }
  }, [context, syncPermission])

  if (state === 'checking' || state === 'hidden') return null

  const enabled = state === 'enabled'
  const denied = state === 'denied'
  const label = enabled
    ? 'Notificações ativadas'
    : denied
      ? 'Ative as notificações nos Ajustes do iPhone'
      : 'Ativar notificações de mensagens'

  return (
    <div className="chat-push-control">
      <button
        type="button"
        className={`chat-push-button ${enabled ? 'is-enabled' : ''}`}
        aria-label={label}
        aria-pressed={enabled}
        title={label}
        disabled={busy || enabled || denied}
        onClick={() => syncPermission(true)}
      >
        {Icon ? <Icon name={enabled ? 'check' : 'bell'} className="chat-action-icon" /> : <span aria-hidden="true">{enabled ? '✓' : '•'}</span>}
      </button>
      {busy ? <span className="chat-push-feedback" role="status">Ativando avisos…</span> : null}
      {!busy && feedback ? <span className="chat-push-feedback" role="status">{feedback}</span> : null}
    </div>
  )
}
