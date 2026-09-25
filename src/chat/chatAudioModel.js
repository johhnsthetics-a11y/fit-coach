export const CHAT_AUDIO_PLAYBACK_RATES = Object.freeze([1, 1.5, 2])

const CANCEL_DISTANCE = 72

export function classifyChatAudioGesture({ dx = 0, dy = 0 } = {}) {
  if (Number(dx) <= -CANCEL_DISTANCE && Math.abs(Number(dx)) >= Math.abs(Number(dy))) return 'cancel'
  return 'hold'
}

export function shouldUsePressToRecord(pointerType = '') {
  return pointerType === 'touch' || pointerType === 'pen'
}

export function prefersMp4ChatAudio({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  const ua = String(userAgent || '')
  const devicePlatform = String(platform || '')
  return /iPhone|iPad|iPod/i.test(ua)
    || (/Mac/i.test(devicePlatform) && Number(maxTouchPoints || 0) > 1)
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

export function selectChatAudioMimeType(
  isTypeSupported = globalThis.MediaRecorder?.isTypeSupported?.bind(globalThis.MediaRecorder),
  { preferMp4 = false } = {},
) {
  if (typeof isTypeSupported !== 'function') return ''
  const candidates = preferMp4
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    : ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']

  return candidates.find((type) => {
    try {
      return Boolean(isTypeSupported(type))
    } catch {
      return false
    }
  }) || ''
}

export function normalizeChatAudioMimeType(value = '') {
  return String(value || '').split(';')[0].trim().toLowerCase() || 'audio/webm'
}

export function chatAudioExtension(mimeType = '') {
  const normalized = normalizeChatAudioMimeType(mimeType)
  if (normalized === 'audio/mp4') return 'm4a'
  if (normalized === 'audio/ogg') return 'ogg'
  if (normalized === 'audio/mpeg') return 'mp3'
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return 'wav'
  return 'webm'
}

export function stopChatAudioStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try { track.stop() } catch {}
  })
}
