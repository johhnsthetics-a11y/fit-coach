import { CHAT_COMPOSER_SELECTORS } from './chatEnhancements.js'

export const CHAT_AUDIO_PLAYBACK_RATES = Object.freeze([1, 1.5, 2])

const CANCEL_DISTANCE = 84
const LOCK_DISTANCE = 72
const enhancedForms = new WeakSet()
const enhancedPlayers = new WeakSet()
const controllers = new WeakMap()
const activeControllers = new Set()

export function classifyChatAudioGesture({ dx = 0, dy = 0 } = {}) {
  if (Number(dx) <= -CANCEL_DISTANCE && Math.abs(Number(dx)) >= Math.abs(Number(dy))) return 'cancel'
  if (Number(dy) <= -LOCK_DISTANCE) return 'lock'
  return 'hold'
}

export function shouldUsePressToRecord(pointerType = '') {
  return pointerType === 'touch' || pointerType === 'pen'
}

export function formatChatAudioDuration(milliseconds = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function nextChatAudioPlaybackRate(currentRate = 1) {
  const index = CHAT_AUDIO_PLAYBACK_RATES.indexOf(Number(currentRate))
  return CHAT_AUDIO_PLAYBACK_RATES[(index + 1) % CHAT_AUDIO_PLAYBACK_RATES.length]
}

export function selectChatAudioMimeType(isTypeSupported = globalThis.MediaRecorder?.isTypeSupported?.bind(globalThis.MediaRecorder)) {
  if (typeof isTypeSupported !== 'function') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((type) => {
    try {
      return Boolean(isTypeSupported(type))
    } catch {
      return false
    }
  }) || ''
}

export function stopChatAudioStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try { track.stop() } catch {}
  })
}

function requestFrame(callback) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback)
  }
  return setTimeout(callback, 0)
}

function getAudioExtension(mimeType = '') {
  if (/mp4|m4a/i.test(mimeType)) return 'm4a'
  if (/ogg/i.test(mimeType)) return 'ogg'
  return 'webm'
}

function createRecordedFile(blob, mimeType) {
  const extension = getAudioExtension(mimeType)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return new File([blob], `coachfit-audio-${stamp}.${extension}`, { type: mimeType || blob.type || 'audio/webm' })
}

function findAudioButton(form) {
  return [...form.querySelectorAll('button')].find((button) => (
    /gravar áudio|parar gravação|gravar audio|parar gravacao|áudio|audio/i.test(button.textContent || '')
    || button.classList.contains('chat-pro-audio-button')
  )) || null
}

function findAttachmentInput(form) {
  return form.querySelector('input[type="file"][accept*="audio"], input[type="file"]')
}

function findSubmitButton(form) {
  return [...form.querySelectorAll('button')].find((button) => (
    button.type === 'submit' || /enviar (mensagem|resposta)|enviando/i.test(button.textContent || '')
  )) || null
}

function dispatchFileEvents(input) {
  const EventCtor = input?.ownerDocument?.defaultView?.Event || globalThis.Event
  if (typeof EventCtor !== 'function') return
  input.dispatchEvent(new EventCtor('input', { bubbles: true }))
  input.dispatchEvent(new EventCtor('change', { bubbles: true }))
}

function setInputFile(input, file) {
  if (!input || !file) return false
  const DataTransferCtor = input.ownerDocument?.defaultView?.DataTransfer || globalThis.DataTransfer

  if (typeof DataTransferCtor === 'function') {
    try {
      const transfer = new DataTransferCtor()
      transfer.items.add(file)
      input.files = transfer.files
      dispatchFileEvents(input)
      return true
    } catch {}
  }

  try {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })
    dispatchFileEvents(input)
    return true
  } catch {
    return false
  }
}

function createWave(documentRoot, count = 18) {
  const wave = documentRoot.createElement('span')
  wave.className = 'chat-pro-audio-wave'
  wave.setAttribute('aria-hidden', 'true')
  for (let index = 0; index < count; index += 1) {
    const bar = documentRoot.createElement('i')
    bar.style.setProperty('--chat-audio-bar', String(8 + ((index * 7) % 15)))
    wave.appendChild(bar)
  }
  return wave
}

function updateWaveProgress(wave, ratio) {
  const bars = [...(wave?.children || [])]
  const activeCount = Math.round(Math.min(Math.max(Number(ratio) || 0, 0), 1) * bars.length)
  bars.forEach((bar, index) => bar.classList.toggle('chat-pro-audio-wave-active', index < activeCount))
}

function decorateAudioElement(audio) {
  if (!(audio instanceof HTMLAudioElement) || enhancedPlayers.has(audio)) return
  if (audio.closest('.chat-pro-audio-preview')) return
  enhancedPlayers.add(audio)

  const documentRoot = audio.ownerDocument
  audio.classList.add('chat-pro-native-audio')
  audio.controls = false

  const player = documentRoot.createElement('div')
  player.className = 'chat-pro-audio-player'

  const play = documentRoot.createElement('button')
  play.type = 'button'
  play.className = 'chat-pro-audio-play'
  play.setAttribute('aria-label', 'Reproduzir áudio')
  play.textContent = '▶'

  const wave = createWave(documentRoot)
  const range = documentRoot.createElement('input')
  range.type = 'range'
  range.min = '0'
  range.max = '1000'
  range.step = '1'
  range.value = '0'
  range.className = 'chat-pro-audio-progress'
  range.setAttribute('aria-label', 'Progresso do áudio')

  const time = documentRoot.createElement('span')
  time.className = 'chat-pro-audio-time'
  time.textContent = '0:00'

  const speed = documentRoot.createElement('button')
  speed.type = 'button'
  speed.className = 'chat-pro-audio-speed'
  speed.setAttribute('aria-label', 'Alterar velocidade do áudio')
  speed.textContent = '1x'

  const progressWrap = documentRoot.createElement('div')
  progressWrap.className = 'chat-pro-audio-progress-wrap'
  progressWrap.append(wave, range)
  player.append(play, progressWrap, time, speed)
  audio.insertAdjacentElement('afterend', player)

  function render() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    const ratio = duration > 0 ? current / duration : 0
    range.value = String(Math.round(ratio * 1000))
    time.textContent = `${formatChatAudioDuration(current * 1000)} / ${formatChatAudioDuration(duration * 1000)}`
    play.textContent = audio.paused ? '▶' : '❚❚'
    play.setAttribute('aria-label', audio.paused ? 'Reproduzir áudio' : 'Pausar áudio')
    speed.textContent = `${audio.playbackRate}x`
    updateWaveProgress(wave, ratio)
  }

  play.addEventListener('click', async () => {
    if (audio.paused) {
      try { await audio.play() } catch {}
    } else {
      audio.pause()
    }
    render()
  })

  range.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
    audio.currentTime = (Number(range.value) / 1000) * audio.duration
    render()
  })

  speed.addEventListener('click', () => {
    audio.playbackRate = nextChatAudioPlaybackRate(audio.playbackRate)
    render()
  })

  audio.addEventListener('loadedmetadata', render)
  audio.addEventListener('durationchange', render)
  audio.addEventListener('timeupdate', render)
  audio.addEventListener('play', render)
  audio.addEventListener('pause', render)
  audio.addEventListener('ended', render)
  render()
}

function decorateAudioPlayers(root) {
  root?.querySelectorAll?.('audio').forEach(decorateAudioElement)
}

function permissionMessage(error) {
  const name = String(error?.name || '')
  if (/NotAllowedError|SecurityError/i.test(name)) {
    return 'O microfone está bloqueado. Permita o acesso ao microfone nas configurações do navegador e tente novamente.'
  }
  if (/NotFoundError|DevicesNotFoundError/i.test(name)) {
    return 'Nenhum microfone foi encontrado neste dispositivo.'
  }
  return 'Não foi possível iniciar o microfone. Verifique a permissão e tente novamente.'
}

function createRecorderPanel(form) {
  const documentRoot = form.ownerDocument
  const panel = documentRoot.createElement('div')
  panel.className = 'chat-pro-recording-panel'
  panel.setAttribute('aria-live', 'polite')

  const indicator = documentRoot.createElement('span')
  indicator.className = 'chat-pro-recording-dot'

  const timer = documentRoot.createElement('strong')
  timer.className = 'chat-pro-recording-time'
  timer.textContent = '0:00'

  const wave = createWave(documentRoot, 14)
  wave.classList.add('chat-pro-recording-wave')

  const hint = documentRoot.createElement('span')
  hint.className = 'chat-pro-recording-hint'
  hint.textContent = 'Deslize ← para cancelar · ↑ para travar'

  const cancel = documentRoot.createElement('button')
  cancel.type = 'button'
  cancel.className = 'chat-pro-recording-cancel'
  cancel.textContent = 'Cancelar'

  const lock = documentRoot.createElement('button')
  lock.type = 'button'
  lock.className = 'chat-pro-recording-lock'
  lock.textContent = '🔒'
  lock.setAttribute('aria-label', 'Gravação travada')

  const stop = documentRoot.createElement('button')
  stop.type = 'button'
  stop.className = 'chat-pro-recording-stop'
  stop.textContent = '■'
  stop.setAttribute('aria-label', 'Parar gravação')

  const error = documentRoot.createElement('span')
  error.className = 'chat-pro-recording-error'
  error.setAttribute('role', 'status')

  panel.append(indicator, timer, wave, hint, cancel, lock, stop, error)
  form.appendChild(panel)
  return { panel, timer, hint, cancel, lock, stop, error, wave }
}

function createPreviewPanel(form) {
  const documentRoot = form.ownerDocument
  const panel = documentRoot.createElement('div')
  panel.className = 'chat-pro-audio-preview'

  const play = documentRoot.createElement('button')
  play.type = 'button'
  play.className = 'chat-pro-audio-preview-play'
  play.textContent = '▶'
  play.setAttribute('aria-label', 'Ouvir gravação')

  const audio = documentRoot.createElement('audio')
  audio.preload = 'metadata'

  const wave = createWave(documentRoot, 18)
  const time = documentRoot.createElement('span')
  time.className = 'chat-pro-audio-preview-time'
  time.textContent = '0:00'

  const remove = documentRoot.createElement('button')
  remove.type = 'button'
  remove.className = 'chat-pro-audio-preview-remove'
  remove.textContent = 'Excluir'

  const send = documentRoot.createElement('button')
  send.type = 'button'
  send.className = 'chat-pro-audio-preview-send'
  send.textContent = 'Enviar'

  panel.append(play, wave, time, remove, send, audio)
  form.appendChild(panel)
  return { panel, play, audio, wave, time, remove, send }
}

function createController(form) {
  const audioButton = findAudioButton(form)
  if (!audioButton) return null

  const recorderUi = createRecorderPanel(form)
  const previewUi = createPreviewPanel(form)
  const state = {
    form,
    audioButton,
    mediaRecorder: null,
    stream: null,
    chunks: [],
    startedAt: 0,
    timerId: 0,
    pointerId: null,
    startX: 0,
    startY: 0,
    locked: false,
    recording: false,
    pending: false,
    abortPending: false,
    canceled: false,
    previewUrl: '',
    recordedFile: null,
    lastTouchRecording: false,
  }

  function setRecordingUi(active, { locked = false, error = '' } = {}) {
    form.classList.toggle('chat-pro-recording', active)
    form.classList.toggle('chat-pro-recording-locked', active && locked)
    recorderUi.error.textContent = error
    recorderUi.hint.textContent = locked
      ? 'Gravação travada · revise antes de enviar'
      : 'Deslize ← para cancelar · ↑ para travar'
  }

  function clearTimer() {
    if (state.timerId) clearInterval(state.timerId)
    state.timerId = 0
  }

  function cleanupPreview() {
    previewUi.audio.pause()
    previewUi.audio.removeAttribute('src')
    previewUi.audio.load?.()
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl)
    state.previewUrl = ''
    state.recordedFile = null
    form.classList.remove('chat-pro-audio-previewing')
    previewUi.time.textContent = '0:00'
    previewUi.play.textContent = '▶'
    updateWaveProgress(previewUi.wave, 0)
  }

  function cleanupRecording() {
    clearTimer()
    stopChatAudioStream(state.stream)
    state.stream = null
    state.mediaRecorder = null
    state.chunks = []
    state.recording = false
    state.pending = false
    state.locked = false
    state.pointerId = null
    form.classList.remove('chat-pro-recording-cancel-ready', 'chat-pro-recording-lock-ready')
    audioButton.removeAttribute('aria-pressed')
    audioButton.setAttribute('aria-label', 'Gravar áudio')
    setRecordingUi(false)
  }

  function showPreview(blob, mimeType) {
    cleanupPreview()
    state.recordedFile = createRecordedFile(blob, mimeType)
    state.previewUrl = URL.createObjectURL(blob)
    previewUi.audio.src = state.previewUrl
    form.classList.add('chat-pro-audio-previewing')
    requestFrame(() => previewUi.play.focus())
  }

  async function startRecording(pointerEvent) {
    if (state.recording || state.pending || form.classList.contains('chat-pro-audio-previewing')) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingUi(true, { error: 'Este navegador não oferece gravação de áudio compatível.' })
      setTimeout(() => setRecordingUi(false), 2600)
      return
    }

    state.canceled = false
    state.locked = false
    state.abortPending = false
    state.pending = true
    state.pointerId = pointerEvent?.pointerId ?? null
    state.startX = Number(pointerEvent?.clientX || 0)
    state.startY = Number(pointerEvent?.clientY || 0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })

      if (!form.isConnected || state.abortPending) {
        stopChatAudioStream(stream)
        state.pending = false
        state.abortPending = false
        state.pointerId = null
        return
      }

      const mimeType = selectChatAudioMimeType()
      const options = mimeType ? { mimeType, audioBitsPerSecond: 96000 } : { audioBitsPerSecond: 96000 }
      let recorder
      try {
        recorder = new MediaRecorder(stream, options)
      } catch {
        recorder = new MediaRecorder(stream)
      }

      state.pending = false
      state.stream = stream
      state.mediaRecorder = recorder
      state.chunks = []
      state.recording = true
      state.startedAt = Date.now()
      setRecordingUi(true)
      audioButton.setAttribute('aria-pressed', 'true')

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data?.size) state.chunks.push(event.data)
      })

      recorder.addEventListener('stop', () => {
        const effectiveMime = recorder.mimeType || mimeType || state.chunks[0]?.type || 'audio/webm'
        const blob = new Blob(state.chunks, { type: effectiveMime })
        const shouldPreview = !state.canceled && blob.size > 0
        cleanupRecording()
        if (shouldPreview) showPreview(blob, effectiveMime)
      }, { once: true })

      recorder.start(200)
      state.timerId = setInterval(() => {
        if (!state.recording) return
        const elapsed = Date.now() - state.startedAt
        recorderUi.timer.textContent = formatChatAudioDuration(elapsed)
        const phase = (Math.floor(elapsed / 180) % 14) / 14
        updateWaveProgress(recorderUi.wave, phase)
      }, 180)
    } catch (error) {
      state.pending = false
      state.abortPending = false
      cleanupRecording()
      setRecordingUi(true, { error: permissionMessage(error) })
      setTimeout(() => setRecordingUi(false), 3200)
    }
  }

  function finishRecording({ cancel = false } = {}) {
    if (state.pending) {
      state.abortPending = true
      state.canceled = cancel
      return
    }
    if (!state.recording) return
    state.canceled = cancel
    clearTimer()
    try {
      if (state.mediaRecorder?.state !== 'inactive') state.mediaRecorder.stop()
      else cleanupRecording()
    } catch {
      cleanupRecording()
    }
  }

  function lockRecording() {
    if (!state.recording) return
    state.locked = true
    state.pointerId = null
    form.classList.add('chat-pro-recording-locked')
    recorderUi.hint.textContent = 'Gravação travada · toque em parar para revisar'
    audioButton.setAttribute('aria-label', 'Gravação de áudio em andamento')
  }

  function handlePointerDown(event) {
    if (!shouldUsePressToRecord(event.pointerType)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    state.lastTouchRecording = true
    audioButton.setPointerCapture?.(event.pointerId)
    startRecording(event)
  }

  function handlePointerMove(event) {
    if ((!state.recording && !state.pending) || state.locked || state.pointerId !== event.pointerId) return
    const gesture = classifyChatAudioGesture({
      dx: event.clientX - state.startX,
      dy: event.clientY - state.startY,
    })
    form.classList.toggle('chat-pro-recording-cancel-ready', gesture === 'cancel')
    form.classList.toggle('chat-pro-recording-lock-ready', gesture === 'lock')
    if (state.recording && gesture === 'lock') lockRecording()
    if (state.pending && gesture === 'cancel') state.abortPending = true
  }

  function handlePointerUp(event) {
    if (state.pointerId !== event.pointerId || state.locked) return
    if (!state.recording && !state.pending) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const gesture = classifyChatAudioGesture({
      dx: event.clientX - state.startX,
      dy: event.clientY - state.startY,
    })
    form.classList.remove('chat-pro-recording-cancel-ready', 'chat-pro-recording-lock-ready')
    finishRecording({ cancel: gesture === 'cancel' || state.pending })
  }

  function handlePointerCancel(event) {
    if (state.pointerId != null && event?.pointerId != null && state.pointerId !== event.pointerId) return
    state.abortPending = true
    finishRecording({ cancel: true })
  }

  function handleClick(event) {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (state.lastTouchRecording) {
      state.lastTouchRecording = false
      return
    }
    if (state.recording || state.pending) finishRecording()
    else startRecording(event)
  }

  audioButton.addEventListener('pointerdown', handlePointerDown, true)
  audioButton.addEventListener('pointermove', handlePointerMove, true)
  audioButton.addEventListener('pointerup', handlePointerUp, true)
  audioButton.addEventListener('pointercancel', handlePointerCancel, true)
  audioButton.addEventListener('click', handleClick, true)
  recorderUi.cancel.addEventListener('click', () => finishRecording({ cancel: true }))
  recorderUi.stop.addEventListener('click', () => finishRecording())

  previewUi.play.addEventListener('click', async () => {
    if (previewUi.audio.paused) {
      try { await previewUi.audio.play() } catch {}
    } else {
      previewUi.audio.pause()
    }
  })
  previewUi.audio.addEventListener('play', () => { previewUi.play.textContent = '❚❚' })
  previewUi.audio.addEventListener('pause', () => { previewUi.play.textContent = '▶' })
  previewUi.audio.addEventListener('loadedmetadata', () => {
    previewUi.time.textContent = formatChatAudioDuration((previewUi.audio.duration || 0) * 1000)
  })
  previewUi.audio.addEventListener('timeupdate', () => {
    const duration = previewUi.audio.duration || 0
    const ratio = duration > 0 ? previewUi.audio.currentTime / duration : 0
    updateWaveProgress(previewUi.wave, ratio)
    previewUi.time.textContent = `${formatChatAudioDuration(previewUi.audio.currentTime * 1000)} / ${formatChatAudioDuration(duration * 1000)}`
  })

  previewUi.remove.addEventListener('click', cleanupPreview)
  previewUi.send.addEventListener('click', () => {
    if (!state.recordedFile) return
    const input = findAttachmentInput(form)
    if (!setInputFile(input, state.recordedFile)) {
      previewUi.time.textContent = 'Não foi possível anexar o áudio neste navegador.'
      return
    }
    previewUi.send.disabled = true
    previewUi.send.textContent = 'Enviando…'
    requestFrame(() => requestFrame(() => {
      if (!form.isConnected) return
      const submitButton = findSubmitButton(form)
      try {
        form.requestSubmit(submitButton && !submitButton.disabled ? submitButton : undefined)
      } catch {
        form.requestSubmit()
      }
      previewUi.send.disabled = false
      previewUi.send.textContent = 'Enviar'
    }))
  })

  function cleanup() {
    if (state.pending) {
      state.abortPending = true
      clearTimer()
      setRecordingUi(false)
    } else if (state.recording) {
      finishRecording({ cancel: true })
    } else {
      cleanupRecording()
    }
    cleanupPreview()
  }

  const api = { cleanup, form, state }
  controllers.set(form, api)
  activeControllers.add(api)
  return api
}

function enhanceForm(form) {
  if (!(form instanceof HTMLFormElement)) return
  decorateAudioPlayers(form.parentElement || form)
  if (enhancedForms.has(form)) return
  const controller = createController(form)
  if (!controller) return
  enhancedForms.add(form)
}

function enhanceCurrentChats(documentRoot) {
  CHAT_COMPOSER_SELECTORS.forEach((selector) => {
    documentRoot.querySelectorAll(selector).forEach((textarea) => enhanceForm(textarea.closest('form')))
  })
  decorateAudioPlayers(documentRoot)
}

function cleanupDisconnectedControllers() {
  ;[...activeControllers].forEach((controller) => {
    if (controller.form?.isConnected) return
    controller.cleanup()
    activeControllers.delete(controller)
  })
}

function cleanupAllControllers() {
  ;[...activeControllers].forEach((controller) => controller.cleanup())
}

export function installChatAudioEnhancements(documentRoot = globalThis.document) {
  if (!documentRoot?.body || typeof MutationObserver === 'undefined') return () => {}
  enhanceCurrentChats(documentRoot)

  const view = documentRoot.defaultView
  const visualViewport = view?.visualViewport
  const updateVisualViewport = () => {
    const height = Number(visualViewport?.height || view?.innerHeight || 0)
    if (height > 0) documentRoot.documentElement?.style.setProperty('--chat-pro-visual-height', `${Math.round(height)}px`)
  }
  updateVisualViewport()
  visualViewport?.addEventListener?.('resize', updateVisualViewport, { passive: true })
  visualViewport?.addEventListener?.('scroll', updateVisualViewport, { passive: true })

  const handleConversationSelection = (event) => {
    const button = event.target?.closest?.('button')
    if (!button?.querySelector?.('.line-clamp-2')) return
    cleanupAllControllers()
  }
  documentRoot.addEventListener('click', handleConversationSelection, true)

  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestFrame(() => {
      queued = false
      cleanupDisconnectedControllers()
      enhanceCurrentChats(documentRoot)
    })
  })
  observer.observe(documentRoot.body, { childList: true, subtree: true })

  const handlePageHide = () => cleanupAllControllers()
  view?.addEventListener?.('pagehide', handlePageHide)

  return () => {
    observer.disconnect()
    cleanupAllControllers()
    activeControllers.clear()
    documentRoot.removeEventListener('click', handleConversationSelection, true)
    view?.removeEventListener?.('pagehide', handlePageHide)
    visualViewport?.removeEventListener?.('resize', updateVisualViewport)
    visualViewport?.removeEventListener?.('scroll', updateVisualViewport)
    documentRoot.documentElement?.style.removeProperty('--chat-pro-visual-height')
  }
}
