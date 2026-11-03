import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadRemoteChatSafetyStatus,
  setRemoteChatBlock,
  sendRemoteChatReport,
  supabaseEnabled,
} from '../supabaseApi'

const EMPTY = Object.freeze({ blocked: false, blockedByYou: false, blockedByOther: false })

// No polling: one request per conversation and a bounded refresh when the
// native app returns to the foreground. This avoids unnecessary Supabase egress.
export function useChatSafety({ studentId, viewerRole, inviteCode = '' }) {
  const key = `${viewerRole || ''}:${studentId || ''}:${inviteCode || ''}`
  const [snapshot, setSnapshot] = useState({ key: '', phase: 'loading', value: EMPTY, error: '' })
  const [busy, setBusy] = useState(false)
  const requestId = useRef(0)
  const lastRefresh = useRef(0)
  const activeKey = useRef(key)
  activeKey.current = key
  const enabled = Boolean(supabaseEnabled && studentId && (viewerRole === 'coach' || viewerRole === 'student'))

  const refresh = useCallback(async () => {
    if (!enabled) return EMPTY
    const requestedKey = key
    const request = ++requestId.current
    setSnapshot(current => ({ key: requestedKey, phase: 'loading', value: current.key === requestedKey ? current.value : EMPTY, error: '' }))
    try {
      const status = await loadRemoteChatSafetyStatus(studentId, viewerRole === 'student' ? inviteCode : '')
      if (activeKey.current === requestedKey && request === requestId.current) {
        setSnapshot({ key: requestedKey, phase: 'ready', value: status || EMPTY, error: '' })
        lastRefresh.current = Date.now()
      }
      return status || EMPTY
    } catch (error) {
      if (activeKey.current === requestedKey && request === requestId.current) {
        setSnapshot({ key: requestedKey, phase: 'error', value: EMPTY, error: error?.message || 'Não foi possível verificar a segurança do chat.' })
      }
      throw error
    }
  }, [enabled, key, studentId, viewerRole, inviteCode])

  useEffect(() => {
    if (!enabled) {
      setSnapshot({ key, phase: 'ready', value: EMPTY, error: '' })
      return undefined
    }
    // A detached promise must not leave an unhandled rejection on navigation.
    refresh().catch(() => undefined)
    return () => { requestId.current += 1 }
  }, [enabled, key, refresh])

  useEffect(() => {
    if (!enabled) return undefined
    const onResume = () => {
      if (!document.hidden && Date.now() - lastRefresh.current > 15000) refresh().catch(() => undefined)
    }
    window.addEventListener('focus', onResume)
    document.addEventListener('visibilitychange', onResume)
    return () => {
      window.removeEventListener('focus', onResume)
      document.removeEventListener('visibilitychange', onResume)
    }
  }, [enabled, refresh])

  const status = !enabled
    ? { phase: 'ready', value: EMPTY, error: '' }
    : snapshot.key === key ? snapshot : { phase: 'loading', value: EMPTY, error: '' }

  const setBlocked = useCallback(async (blocked) => {
    if (!enabled || status.phase !== 'ready' || busy) throw new Error('Aguarde a verificação da conversa.')
    const operationKey = key
    setBusy(true)
    try {
      const updated = await setRemoteChatBlock(studentId, Boolean(blocked), viewerRole === 'student' ? inviteCode : '')
      if (activeKey.current === operationKey) {
        setSnapshot({ key: operationKey, phase: 'ready', value: updated || EMPTY, error: '' })
      }
      return updated
    } catch (error) {
      if (activeKey.current === operationKey) await refresh().catch(() => undefined)
      throw error
    } finally {
      if (activeKey.current === operationKey) setBusy(false)
    }
  }, [enabled, status.phase, busy, key, studentId, viewerRole, inviteCode, refresh])

  const report = useCallback(async (payload) => {
    if (!enabled || status.phase !== 'ready') throw new Error('Não foi possível validar esta conversa.')
    return sendRemoteChatReport(studentId, payload, viewerRole === 'student' ? inviteCode : '')
  }, [enabled, status.phase, studentId, viewerRole, inviteCode])

  return {
    enabled, phase: status.phase, ...status.value, error: status.error, busy,
    refresh, setBlocked, report,
  }
}
