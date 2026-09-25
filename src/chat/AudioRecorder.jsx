import { useEffect, useRef, useState } from 'react'
import {
  chatAudioExtension,
  classifyChatAudioGesture,
  normalizeChatAudioMimeType,
  prefersMp4ChatAudio,
  selectChatAudioMimeType,
  stopChatAudioStream,
} from './chatAudioModel'

const MIN_RECORDING_MS = 500
const MIN_AUDIO_BYTES = 256

function formatElapsed(milliseconds = 0) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function IconSlot({ Icon, name, fallback }) {
  return Icon ? <Icon name={name} className="chat-action-icon" /> : <span aria-hidden="true">{fallback}</span>
}

function RecordingWaveform() {
  return (
    <span className="chat-recording-wave" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <i key={index} style={{ '--wave-index': index }} />
      ))}
    </span>
  )
}

export function AudioRecorder({ disabled = false, onRecorded, onError, onRecordingChange, Icon }) {
  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [gesture, setGesture] = useState('hold')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const pointerRef = useRef(null)
  const pointerCleanupRef = useRef(null)
  const timerRef = useRef(0)
  const startedAtRef = useRef(0)
  const pendingRef = useRef(false)
  const canceledRef = useRef(false)
  const deferredStopRef = useRef('')
  const ignoreClickRef = useRef(false)

  function clearTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = 0
  }

  function detachPointerListeners() {
    try { pointerCleanupRef.current?.() } catch {}
    pointerCleanupRef.current = null
  }

  function updateRecording(nextValue) {
    setRecording(nextValue)
    onRecordingChange?.(nextValue)
  }

  function resetUi() {
    clearTimer()
    detachPointerListeners()
    updateRecording(false)
    setElapsedMs(0)
    setGesture('hold')
    pointerRef.current = null
  }

  useEffect(() => () => {
    canceledRef.current = true
    deferredStopRef.current = 'cancel'
    clearTimer()
    detachPointerListeners()
    try {
      if (recorderRef.current?.state && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    } catch {}
    stopChatAudioStream(streamRef.current)
  }, [])

  async function startRecording() {
    if (disabled || recording || pendingRef.current) return
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError?.('Seu navegador não liberou a gravação de áudio. Você ainda pode anexar um arquivo de áudio.')
      return
    }

    pendingRef.current = true
    canceledRef.current = false
    deferredStopRef.current = ''
    onError?.('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      if (canceledRef.current) {
        stopChatAudioStream(stream)
        pendingRef.current = false
        return
      }

      const preferMp4 = prefersMp4ChatAudio({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
      })
      const mimeType = selectChatAudioMimeType((type) => {
        try { return window.MediaRecorder.isTypeSupported?.(type) } catch { return false }
      }, { preferMp4 })

      let recorder
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 96000 } : undefined)
      } catch {
        recorder = new MediaRecorder(stream)
      }

      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const effectiveType = recorder.mimeType || mimeType || chunksRef.current[0]?.type || 'audio/webm'
        const normalizedType = normalizeChatAudioMimeType(effectiveType)
        const blob = new Blob(chunksRef.current, { type: normalizedType })
        const canceled = canceledRef.current
        const elapsed = Date.now() - startedAtRef.current
        const extension = chatAudioExtension(normalizedType)

        recorderRef.current = null
        pendingRef.current = false
        stopChatAudioStream(streamRef.current)
        streamRef.current = null
        resetUi()

        if (canceled) return
        if (elapsed < MIN_RECORDING_MS || blob.size < MIN_AUDIO_BYTES) {
          onError?.('Gravação muito curta. Segure o microfone por um pouco mais de tempo.')
          return
        }

        onRecorded?.(new File([blob], `audio-coachfit-${Date.now()}.${extension}`, { type: normalizedType }))
      }

      recorderRef.current = recorder
      pendingRef.current = false
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      updateRecording(true)
      recorder.start(200)
      timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 120)

      if (deferredStopRef.current) {
        const cancel = deferredStopRef.current === 'cancel'
        deferredStopRef.current = ''
        window.setTimeout(() => stopRecording(cancel), 0)
      }
    } catch (recordingError) {
      pendingRef.current = false
      stopChatAudioStream(streamRef.current)
      streamRef.current = null
      resetUi()
      const blocked = /NotAllowedError|SecurityError/i.test(String(recordingError?.name || ''))
      onError?.(blocked
        ? 'O microfone está bloqueado. Libere a permissão no navegador e tente novamente.'
        : 'Não foi possível acessar o microfone. Confira a permissão do navegador.')
    }
  }

  function stopRecording(cancel = false) {
    canceledRef.current = Boolean(cancel)
    clearTimer()

    if (pendingRef.current) {
      deferredStopRef.current = cancel ? 'cancel' : 'send'
      return
    }

    try {
      if (recorderRef.current?.state && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.requestData?.() } catch {}
        recorderRef.current.stop()
      } else {
        stopChatAudioStream(streamRef.current)
        streamRef.current = null
        resetUi()
      }
    } catch {
      stopChatAudioStream(streamRef.current)
      streamRef.current = null
      resetUi()
    }
  }

  function finishTouchGesture(event, cancel = false) {
    const activePointer = pointerRef.current
    if (!activePointer || activePointer.id !== event.pointerId) return

    event.preventDefault?.()
    const finalGesture = cancel
      ? 'cancel'
      : classifyChatAudioGesture({
          dx: Number(event.clientX || activePointer.lastX || activePointer.x) - activePointer.x,
          dy: Number(event.clientY || activePointer.lastY || activePointer.y) - activePointer.y,
        })
    const shouldCancel = cancel || activePointer.cancelIntent || finalGesture === 'cancel'

    pointerRef.current = null
    detachPointerListeners()
    stopRecording(shouldCancel)
    window.setTimeout(() => { ignoreClickRef.current = false }, 0)
  }

  function bindTouchGesture(pointerId) {
    detachPointerListeners()

    const handleWindowPointerMove = (event) => {
      const activePointer = pointerRef.current
      if (!activePointer || activePointer.id !== pointerId || event.pointerId !== pointerId) return

      event.preventDefault?.()
      activePointer.lastX = event.clientX
      activePointer.lastY = event.clientY
      const nextGesture = classifyChatAudioGesture({
        dx: event.clientX - activePointer.x,
        dy: event.clientY - activePointer.y,
      })

      if (nextGesture === 'cancel') activePointer.cancelIntent = true
      setGesture(activePointer.cancelIntent ? 'cancel' : 'hold')
    }

    const handleWindowPointerUp = (event) => {
      if (event.pointerId !== pointerId) return
      finishTouchGesture(event, false)
    }

    const handleWindowPointerCancel = (event) => {
      if (event.pointerId !== pointerId) return
      finishTouchGesture(event, true)
    }

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
    window.addEventListener('pointerup', handleWindowPointerUp, { passive: false })
    window.addEventListener('pointercancel', handleWindowPointerCancel, { passive: false })

    pointerCleanupRef.current = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerCancel)
    }
  }

  function handlePointerDown(event) {
    if (!['touch', 'pen'].includes(event.pointerType) || disabled) return

    event.preventDefault()
    ignoreClickRef.current = true
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      cancelIntent: false,
    }

    try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch {}
    bindTouchGesture(event.pointerId)
    startRecording()
  }

  function handleClick(event) {
    if (ignoreClickRef.current) {
      event.preventDefault()
      return
    }
    if (recording) stopRecording(false)
    else startRecording()
  }

  const active = recording || pendingRef.current

  return (
    <div className={`chat-audio-recorder-shell ${active ? 'is-recording' : ''}`}>
      <button
        type="button"
        className={`chat-record-button ${active ? 'is-recording' : ''}`}
        aria-label="Gravar áudio"
        title="Segure para gravar áudio"
        disabled={disabled}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
      >
        <IconSlot Icon={Icon} name="mic" fallback="●" />
      </button>

      {active ? (
        <div className={`chat-recording-state chat-recording-${gesture}`} role="status" aria-label="Gravação de áudio em andamento">
          <span className="chat-recording-dot" aria-hidden="true" />
          <strong>{formatElapsed(elapsedMs)}</strong>
          <RecordingWaveform />
          <span className="chat-recording-hint">
            {gesture === 'cancel' ? 'Solte para cancelar' : 'Deslize para a esquerda para cancelar'}
          </span>
          <span className="chat-recording-actions">
            <button type="button" onClick={() => stopRecording(true)} aria-label="Cancelar gravação">Cancelar</button>
            <button type="button" className="chat-recording-finish" onClick={() => stopRecording(false)} aria-label="Finalizar e enviar gravação">Enviar</button>
          </span>
        </div>
      ) : null}
    </div>
  )
}
