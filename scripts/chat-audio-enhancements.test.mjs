import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as chatAudio from '../chatAudioEnhancements.js'

const productionMain = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const audioCss = readFileSync(new URL('../chat-audio.css', import.meta.url), 'utf8')
const audioSource = readFileSync(new URL('../chatAudioEnhancements.js', import.meta.url), 'utf8')

const {
  CHAT_AUDIO_PLAYBACK_RATES,
  classifyChatAudioGesture,
  formatChatAudioDuration,
  nextChatAudioPlaybackRate,
  selectChatAudioMimeType,
  shouldUsePressToRecord,
  stopChatAudioStream,
} = chatAudio

test('produção instala a camada de áudio do chat', () => {
  assert.match(productionMain, /installChatAudioEnhancements/)
  assert.match(productionMain, /chat-audio\.css/)
})

test('chat possui estados visuais para gravação, preview e player mobile', () => {
  assert.match(audioCss, /chat-pro-recording/)
  assert.match(audioCss, /chat-pro-audio-preview/)
  assert.match(audioCss, /chat-pro-audio-player/)
  assert.match(audioCss, /env\(safe-area-inset-bottom(?:,\s*0px)?\)/)
  assert.match(audioCss, /100dvh/)
})

test('player de áudio cabe na bolha em telas mobile estreitas', () => {
  assert.doesNotMatch(audioCss, /min-width:\s*min\(17\.4rem,\s*76vw\)/)
  assert.match(audioCss, /\.chat-pro-audio-player\s*\{[\s\S]*?max-width:\s*100%/)
})

test('gestos de gravação distinguem cancelar, travar e manter pressionado', () => {
  assert.equal(classifyChatAudioGesture({ dx: -96, dy: -20 }), 'cancel')
  assert.equal(classifyChatAudioGesture({ dx: -10, dy: -90 }), 'lock')
  assert.equal(classifyChatAudioGesture({ dx: -18, dy: -14 }), 'hold')
})

test('gravação por pressão é usada em touch/pen e desktop usa clique', () => {
  assert.equal(shouldUsePressToRecord('touch'), true)
  assert.equal(shouldUsePressToRecord('pen'), true)
  assert.equal(shouldUsePressToRecord('mouse'), false)
})

test('duração do áudio é formatada para minutos e segundos', () => {
  assert.equal(formatChatAudioDuration(0), '0:00')
  assert.equal(formatChatAudioDuration(65000), '1:05')
  assert.equal(formatChatAudioDuration(3_599_000), '59:59')
})

test('velocidade do player alterna 1x, 1.5x e 2x em ciclo', () => {
  assert.deepEqual(CHAT_AUDIO_PLAYBACK_RATES, [1, 1.5, 2])
  assert.equal(nextChatAudioPlaybackRate(1), 1.5)
  assert.equal(nextChatAudioPlaybackRate(1.5), 2)
  assert.equal(nextChatAudioPlaybackRate(2), 1)
})

test('mime do recorder prioriza opus e possui fallback para Safari', () => {
  const onlyMp4 = (type) => type === 'audio/mp4'
  assert.equal(selectChatAudioMimeType(onlyMp4), 'audio/mp4')

  const supportsOpus = (type) => type === 'audio/webm;codecs=opus' || type === 'audio/mp4'
  assert.equal(selectChatAudioMimeType(supportsOpus), 'audio/webm;codecs=opus')

  assert.equal(selectChatAudioMimeType(() => false), '')
})

test('cleanup do microfone encerra todas as tracks mesmo se uma falhar', () => {
  const stopped = []
  stopChatAudioStream({
    getTracks() {
      return [
        { stop() { stopped.push('a') } },
        { stop() { stopped.push('b'); throw new Error('track já encerrada') } },
        { stop() { stopped.push('c') } },
      ]
    },
  })
  assert.deepEqual(stopped, ['a', 'b', 'c'])
})

test('camada de áudio trata troca de conversa, pagehide, Safari e teclado virtual', () => {
  assert.match(audioSource, /line-clamp-2/)
  assert.match(audioSource, /pagehide/)
  assert.match(audioSource, /visualViewport/)
  assert.match(audioSource, /Object\.defineProperty/)
  assert.match(audioSource, /pointercancel/)
  assert.match(audioCss, /--chat-pro-visual-height/)
})
