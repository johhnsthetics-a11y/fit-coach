import { CHAT_COMPOSER_SELECTORS } from './chatEnhancements.js'

export const CHAT_AUDIO_PLAYBACK_RATES = Object.freeze([1, 1.5, 2])

const CANCEL_DISTANCE = 84
const LOCK_DISTANCE = 72
const enhancedForms = new WeakSet()
const enhancedPlayers = new WeakSet()
const controllers = new WeakMap()

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

function setInputFile(input, file) {
  if (!input || !file || typeof DataTransfer === 'undefined') return false
  try {
    const transfer = new DataTransfer()
    transfer.items.add(file)
    input.files = transfer.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
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

  function stopTracks() {
    state.stream?.getTracks?.().forEach((track) => {
      try { track.stop() } catch {}
    })
    state.stream = null
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
    stopTracks()
    state.mediaRecorder = null
    state.chunks = []
    state.recording = false
    state.locked = false
    state.pointerId = null
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
    if (state.recording || form.classList.contains('chat-pro-audio-previewing')) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingUi(true, { error: 'Este navegador não oferece gravação de áudio compatível.' })
      setTimeout(() => setRecordingUi(false), 2600)
      return
    }

    state.canceled = false
    state.locked = false
    state.pointerId = pointerEvent?.pointerId ?? null
    state.startX = Number(pointerEvent?.clientX || 0)
    state.startY = Number(pointerEvent?.clientY || 0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      if (!form.isConnected) {
        stream.getTracks().forEach((track) => track.stop())
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
        audioButton.removeAttribute('aria-pressed')
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
      cleanupRecording()
      setRecordingUi(true, { error: permissionMessage(error) })
      setTimeout(() => setRecordingUi(false), 3200)
    }
  }

  function finishRecording({ cancel = false } = {}) {
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
    if (!state.recording || state.locked || state.pointerId !== event.pointerId) return
    const gesture = classifyChatAudioGesture({
      dx: event.clientX - state.startX,
      dy: event.clientY - state.startY,
    })
    form.classList.toggle('chat-pro-recording-cancel-ready', gesture === 'cancel')
    form.classList.toggle('chat-pro-recording-lock-ready', gesture === 'lock')
    if (gesture === 'lock') lockRecording()
  }

  function handlePointerUp(event) {
    if (!state.recording || state.locked || state.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const gesture = classifyChatAudioGesture({
      dx: event.clientX - state.startX,
      dy: event.clientY - state.startY,
    })
    form.classList.remove('chat-pro-recording-cancel-ready', 'chat-pro-recording-lock-ready')
    finishRecording({ cancel: gesture === 'cancel' })
  }

  function handleClick(event) {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (state.lastTouchRecording) {
      state.lastTouchRecording = false
      return
    }
    if (state.recording) finishRecording()
    else startRecording(event)
  }

  audioButton.addEventListener('pointerdown', handlePointerDown, true)
  audioButton.addEventListener('pointermove', handlePointerMove, true)
  audioButton.addEventListener('pointerup', handlePointerUp, true)
  audioButton.addEventListener('pointercancel', () => finishRecording({ cancel: true }), true)
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
    setTimeout(() => {
      if (!form.isConnected) return
      try { form.requestSubmit(findSubmitButton(form) || undefined) } catch { form.requestSubmit() }
      previewUi.send.disabled = false
      previewUi.send.textContent = 'Enviar'
    }, 0)
  })

  function cleanup() {
    if (state.recording) finishRecording({ cancel: true })
    else cleanupRecording()
    cleanupPreview()
  }

  const api = { cleanup, state }
  controllers.set(form, api)
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

export function installChatAudioEnhancements(documentRoot = globalThis.document) {
  if (!documentRoot?.body || typeof MutationObserver === 'undefined') return () => {}
  enhanceCurrentChats(documentRoot)

  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestFrame(() => {
      queued = false
      enhanceCurrentChats(documentRoot)
      controllers.forEach?.(() => {})
    })
  })
  observer.observe(documentRoot.body, { childList: true, subtree: true })

  const cleanupDisconnected = () => {
    documentRoot.querySelectorAll?.('form.chat-pro-composer').forEach((form) => {
      if (!form.isConnected) controllers.get(form)?.cleanup?.()
    })
  }
  documentRoot.defaultView?.addEventListener?.('pagehide', cleanupDisconnected)

  return () => {
    observer.disconnect()
    documentRoot.defaultView?.removeEventListener?.('pagehide', cleanupDisconnected)
    CHAT_COMPOSER_SELECTORS.forEach((selector) => {
      documentRoot.querySelectorAll(selector).forEach((textarea) => controllers.get(textarea.closest('form'))?.cleanup?.())
    })
  }
}
