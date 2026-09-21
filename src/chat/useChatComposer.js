import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getChatDraftKey, loadChatDraft, saveChatDraft } from './chatDraft'
import { createChatMessageId } from './chatMessageIdentity'

const IMAGE_MAX_BYTES = 8 * 1024 * 1024
const AUDIO_MAX_BYTES = 20 * 1024 * 1024

function browserStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function revokePreview(preview) {
  if (!String(preview || '').startsWith('blob:')) return
  try { URL.revokeObjectURL(preview) } catch {}
}

function createPreview(file) {
  if (!file || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''
  try { return URL.createObjectURL(file) } catch { return '' }
}

export function validateChatAttachment(file) {
  if (!file) return ''
  const type = String(file.type || '').toLowerCase()
  const isImage = type.startsWith('image/')
  const isAudio = type.startsWith('audio/')
  if (!isImage && !isAudio) return 'Selecione uma imagem ou áudio válido.'
  if (Number(file.size || 0) > (isAudio ? AUDIO_MAX_BYTES : IMAGE_MAX_BYTES)) {
    return isAudio ? 'O áudio deve ter no máximo 20 MB.' : 'A foto deve ter no máximo 8 MB.'
  }
  return ''
}

export function useChatComposer({ context, storage, onSend, buildPayload } = {}) {
  const resolvedStorage = storage === undefined ? browserStorage() : storage
  const contextKey = getChatDraftKey(context)
  const [draft, setDraftState] = useState(() => loadChatDraft(resolvedStorage, context))
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const sendingRef = useRef(false)
  const contextKeyRef = useRef(contextKey)
  const restoringDraftRef = useRef(false)
  const previewRef = useRef('')
  const failedAttemptRef = useRef(new Map())
  const attachmentDraftRef = useRef(new Map())

  const stableContext = useMemo(() => ({
    role: context?.role || 'user',
    studentId: context?.studentId || 'conversation',
  }), [context?.role, context?.studentId])

  useEffect(() => {
    contextKeyRef.current = contextKey
    restoringDraftRef.current = true
    const failedAttempt = failedAttemptRef.current.get(contextKey)
    const restoredAttachment = failedAttempt?.attachment || attachmentDraftRef.current.get(contextKey) || null
    setDraftState(failedAttempt?.draft ?? loadChatDraft(resolvedStorage, stableContext))
    revokePreview(previewRef.current)
    const restoredPreview = createPreview(restoredAttachment)
    previewRef.current = restoredPreview
    setAttachment(restoredAttachment)
    setAttachmentPreview(restoredPreview)
    setError(failedAttempt?.error || '')
  }, [contextKey, resolvedStorage, stableContext])

  useEffect(() => {
    if (restoringDraftRef.current) {
      restoringDraftRef.current = false
      return
    }
    saveChatDraft(resolvedStorage, stableContext, draft)
  }, [draft, resolvedStorage, stableContext])

  useEffect(() => () => revokePreview(previewRef.current), [])

  const setDraft = useCallback((nextValue) => {
    failedAttemptRef.current.delete(contextKeyRef.current)
    setDraftState((current) => (
      typeof nextValue === 'function' ? String(nextValue(current) ?? '') : String(nextValue ?? '')
    ))
    setError('')
  }, [])

  const clearAttachment = useCallback(() => {
    failedAttemptRef.current.delete(contextKeyRef.current)
    attachmentDraftRef.current.delete(contextKeyRef.current)
    revokePreview(previewRef.current)
    previewRef.current = ''
    setAttachment(null)
    setAttachmentPreview('')
  }, [])

  const selectAttachment = useCallback((input) => {
    const file = input?.target?.files?.[0] || input || null
    if (!file) return false
    const validationError = validateChatAttachment(file)
    if (validationError) {
      setError(validationError)
      if (input?.target) input.target.value = ''
      return false
    }

    failedAttemptRef.current.delete(contextKeyRef.current)
    attachmentDraftRef.current.set(contextKeyRef.current, file)
    revokePreview(previewRef.current)
    const preview = createPreview(file)
    previewRef.current = preview
    setAttachment(file)
    setAttachmentPreview(preview)
    setError('')
    if (input?.target) input.target.value = ''
    return true
  }, [])

  const performSubmit = useCallback(async (event) => {
    event?.preventDefault?.()
    const body = draft.trim()
    if (sendingRef.current || (!body && !attachment) || typeof onSend !== 'function') return false

    const submitContextKey = contextKeyRef.current
    const submitContext = { ...stableContext }
    const queuedDraft = draft
    const queuedAttachment = attachment
    const queuedPreview = attachmentPreview
    const previousAttempt = failedAttemptRef.current.get(submitContextKey)
    const clientMessageId = previousAttempt?.clientMessageId || createChatMessageId()
    const basePayload = typeof buildPayload === 'function'
      ? buildPayload({ body, attachmentFile: queuedAttachment, attachmentPreview: queuedPreview })
      : { body, attachmentFile: queuedAttachment, attachmentPreview: queuedPreview }
    const payload = { ...basePayload, clientMessageId }

    sendingRef.current = true
    setSending(true)
    setError('')
    setDraftState('')
    saveChatDraft(resolvedStorage, stableContext, '')
    clearAttachment()

    try {
      await onSend(payload)
      failedAttemptRef.current.delete(submitContextKey)
      return true
    } catch (sendError) {
      const failureMessage = sendError?.message || 'Não foi possível enviar a mensagem.'
      failedAttemptRef.current.set(submitContextKey, {
        clientMessageId,
        draft: queuedDraft,
        attachment: queuedAttachment,
        error: failureMessage,
      })
      if (queuedAttachment) attachmentDraftRef.current.set(submitContextKey, queuedAttachment)
      saveChatDraft(resolvedStorage, submitContext, queuedDraft)
      if (contextKeyRef.current === submitContextKey) {
        setDraftState(queuedDraft)
        if (queuedAttachment) {
          const restoredPreview = createPreview(queuedAttachment)
          previewRef.current = restoredPreview
          setAttachment(queuedAttachment)
          setAttachmentPreview(restoredPreview)
        }
        setError(failureMessage)
      }
      return false
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [attachment, attachmentPreview, buildPayload, clearAttachment, draft, onSend, resolvedStorage, stableContext])

  const retry = useCallback(() => performSubmit(), [performSubmit])

  return {
    draft,
    setDraft,
    attachment,
    attachmentPreview,
    sending,
    error,
    setError,
    clearAttachment,
    selectAttachment,
    submit: performSubmit,
    retry,
  }
}
