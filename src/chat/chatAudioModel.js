export const CHAT_AUDIO_PLAYBACK_RATES = Object.freeze([1, 1.5, 2])

const CANCEL_DISTANCE = 84
const LOCK_DISTANCE = 72

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
