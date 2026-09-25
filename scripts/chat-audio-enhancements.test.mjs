import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as chatAudio from '../src/chat/chatAudioModel.js'

const productionMain = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const audioCss = readFileSync(new URL('../src/chat/chat.css', import.meta.url), 'utf8')
const chatCss = audioCss
const audioSource = readFileSync(new URL('../chatAudioEnhancements.js', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const composerSource = readFileSync(new URL('../src/chat/ChatComposer.jsx', import.meta.url), 'utf8')
const composerHookSource = readFileSync(new URL('../src/chat/useChatComposer.js', import.meta.url), 'utf8')
const recorderSource = readFileSync(new URL('../src/chat/AudioRecorder.jsx', import.meta.url), 'utf8')
const audioMessageSource = readFileSync(new URL('../src/chat/AudioMessage.jsx', import.meta.url), 'utf8')
const attachmentSource = readFileSync(new URL('../src/chat/AttachmentMessage.jsx', import.meta.url), 'utf8')
const conversationSource = readFileSync(new URL('../src/chat/ChatConversation.jsx', import.meta.url), 'utf8')
const apiSource = readFileSync(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')

const {
  CHAT_AUDIO_PLAYBACK_RATES,
  classifyChatAudioGesture,
  formatChatAudioDuration,
  nextChatAudioPlaybackRate,
  prefersMp4ChatAudio,
  selectChatAudioMimeType,
  shouldUsePressToRecord,
  stopChatAudioStream,
} = chatAudio

test('produção usa o áudio React sem decorador global', () => {
  assert.doesNotMatch(productionMain, /installChatAudioEnhancements/)
  assert.doesNotMatch(productionMain, /chat-audio\.css/)
  assert.doesNotMatch(audioSource, /decorateAudio/)
  assert.doesNotMatch(audioSource, /MutationObserver/)
})

test('chat possui estados visuais para gravação, preview e player mobile', () => {
  assert.match(audioCss, /chat-recording-state/)
  assert.match(audioCss, /chat-attachment-preview/)
  assert.match(audioCss, /chat-audio-message/)
  assert.match(chatCss, /env\(safe-area-inset-bottom(?:,\s*0px)?\)/)
  assert.match(chatCss, /100dvh/)
})

test('player de áudio cabe na bolha em telas mobile estreitas', () => {
  assert.doesNotMatch(audioCss, /min-width:\s*min\(17\.4rem,\s*76vw\)/)
  assert.match(audioCss, /\.chat-audio-message\s*\{[\s\S]*?max-width:\s*100%/)
})

test('gesto mobile cancela ao atingir a distância para a esquerda mesmo em diagonal', () => {
  assert.equal(classifyChatAudioGesture({ dx: -96, dy: -20 }), 'cancel')
  assert.equal(classifyChatAudioGesture({ dx: -70, dy: -120 }), 'cancel')
  assert.equal(classifyChatAudioGesture({ dx: -56, dy: 80 }), 'cancel')
  assert.equal(classifyChatAudioGesture({ dx: -10, dy: -90 }), 'hold')
  assert.equal(classifyChatAudioGesture({ dx: -40, dy: -14 }), 'hold')
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

test('mime do recorder prioriza MP4 no iPhone e Opus nos demais navegadores', () => {
  const onlyMp4 = (type) => type === 'audio/mp4'
  assert.equal(selectChatAudioMimeType(onlyMp4), 'audio/mp4')

  const supportsBoth = (type) => type === 'audio/webm;codecs=opus' || type === 'audio/mp4'
  assert.equal(selectChatAudioMimeType(supportsBoth), 'audio/webm;codecs=opus')
  assert.equal(selectChatAudioMimeType(supportsBoth, { preferMp4: true }), 'audio/mp4')
  assert.equal(prefersMp4ChatAudio({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)' }), true)
  assert.equal(prefersMp4ChatAudio({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' }), false)

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

test('áudio React mantém controle do toque até soltar em qualquer ponto da tela', () => {
  assert.match(recorderSource, /stopChatAudioStream/)
  assert.match(recorderSource, /useEffect\(\(\) => \(\) =>/)
  assert.match(recorderSource, /window\.addEventListener\('pointermove'/)
  assert.match(recorderSource, /window\.addEventListener\('pointerup'/)
  assert.match(recorderSource, /window\.addEventListener\('pointercancel'/)
  assert.match(recorderSource, /finishTouchGesture\(event, false\)/)
  assert.match(recorderSource, /finishTouchGesture\(event, true\)/)
  assert.match(recorderSource, /MIN_RECORDING_MS/)
  assert.match(recorderSource, /MIN_AUDIO_BYTES/)
  assert.match(recorderSource, /requestData/)
  assert.match(conversationSource, /visualViewport/)
  assert.match(chatCss, /--chat-pro-visual-height/)
})


test('gravador React é a única fonte de gravação e exibe tempo/ondas no mobile', () => {
  assert.match(recorderSource, /chat-recording-state/)
  assert.match(recorderSource, /chat-recording-wave/)
  assert.match(recorderSource, /elapsedMs/)
  assert.doesNotMatch(appSource, /function AudioRecorderButton/)
  assert.doesNotMatch(audioCss, /@media \(max-width: 390px\)[\s\S]*?\.chat-recording-wave\s*\{\s*display:\s*none/)
})

test('preview nativo de áudio permanece dentro do composer sem salto de layout', () => {
  assert.match(composerSource, /chat-attachment-preview/)
  assert.match(composerSource, /chat-compose/)
  assert.doesNotMatch(composerSource, /requestSubmit\(submitButton/)
})

test('chat expõe ações persistentes de editar e apagar mensagem', () => {
  assert.match(apiSource, /export async function updateRemoteMessage/)
  assert.match(apiSource, /export async function deleteRemoteMessage/)
  assert.match(apiSource, /export async function updateRemoteStudentMessage/)
  assert.match(apiSource, /export async function deleteRemoteStudentMessage/)
  assert.match(appSource, /Editar/)
  assert.match(appSource, /Apagar/)
})


test('apagar mensagem usa soft delete visível para os dois lados', () => {
  assert.match(apiSource, /body:\s*'Mensagem apagada'/)
  assert.match(apiSource, /deleted_at:/)
  assert.match(apiSource, /attachment_url:\s*null/)
  assert.match(apiSource, /method:\s*'PATCH'/)
  assert.doesNotMatch(apiSource, /export async function deleteRemoteMessage[\s\S]*?method:\s*'DELETE'/)
  assert.match(appSource, /message\.deletedAt/)
  assert.match(appSource, /Mensagem apagada/)
  assert.match(appSource, /if \(!canManage \|\| !message\?\.id \|\| message\.deletedAt\) return null/)
})

test('preview React de audio não recebe segundo player decorado', () => {
  assert.match(audioMessageSource, /chat-audio-message/)
  assert.doesNotMatch(audioSource, /decorateAudio/)
})

test('nome técnico de gravação não pode estourar o layout mobile', () => {
  assert.match(attachmentSource, /formatChatAttachmentLabel/)
  assert.match(attachmentSource, /Áudio gravado/)
  assert.match(audioCss, /\.chat-audio-label[\s\S]*?text-overflow:\s*ellipsis/)
  assert.match(audioCss, /\.chat-audio-message[\s\S]*?overflow:\s*hidden/)
})


test('envio de mensagem é otimista para áudio aparecer imediatamente após tocar em enviar', () => {
  assert.match(appSource, /deliveryState:\s*'sending'/)
  assert.match(appSource, /:\s*\[localMessage,\s*\.\.\.\(current\.messages/)
  assert.match(appSource, /String\(item\.id\) === String\(clientMessageId\)/)
  assert.match(appSource, /deliveryState:\s*'failed'/)
  assert.match(appSource, /reconcileMessageDelivery\(current\.messages, localMessage\.id, savedMessage\)/)
  assert.match(composerHookSource, /previewRef\.current = ''[\s\S]*?await onSend\(payload\)[\s\S]*?revokePreview\(queuedPreview\)/)
  assert.match(composerHookSource, /sendAttachmentImmediately/)
})

test('áudio gravado é enviado automaticamente ao soltar sem confirmação extra', () => {
  assert.match(composerSource, /onRecorded=\{sendAttachmentImmediately\}/)
  assert.match(composerHookSource, /const sendAttachmentImmediately = useCallback/)
  assert.match(composerHookSource, /await onSend\(payload\)/)
  assert.match(recorderSource, /Deslize para a esquerda para cancelar/)
  assert.doesNotMatch(recorderSource, /Gravação travada/)
})

test('player renderiza waveform com progresso e recarrega quando a URL definitiva chega', () => {
  assert.match(audioMessageSource, /buildWaveform/)
  assert.match(audioMessageSource, /chat-audio-waveform/)
  assert.match(audioMessageSource, /className=\{played \? 'is-played' : ''\}/)
  assert.match(audioMessageSource, /audio\.load\(\)/)
  assert.match(audioMessageSource, /onCanPlay=\{\(\) => setError\(''\)\}/)
  assert.match(audioCss, /\.chat-audio-waveform/)
  assert.match(audioCss, /\.chat-audio-waveform i\.is-played/)
})

test('anexos do chat usam URL pública estável do bucket que já é público e MIME normalizado', () => {
  assert.match(apiSource, /publicStorageObjectUrl\(MESSAGE_ATTACHMENT_BUCKET, path\)/)
  assert.match(apiSource, /storage\/v1\/object\/public/)
  assert.match(apiSource, /normalizeMessageAttachmentMimeType/)
  assert.match(apiSource, /'Content-Type': contentType/)
})


test('botão do microfone permanece montado durante a gravação mobile', () => {
  assert.match(recorderSource, /const active = recording \|\| pendingRef\.current/)
  assert.match(recorderSource, /chat-audio-recorder-shell/)
  assert.match(recorderSource, /<button[\s\S]*?className=\{\`chat-record-button/)
  assert.doesNotMatch(recorderSource, /if \(recording \|\| pendingRef\.current\) \{[\s\S]*?return \(/)
  assert.match(audioCss, /\.chat-audio-recorder-shell\.is-recording/)
  assert.match(audioCss, /touch-action:\s*none/)
})

test('deslizar para a esquerda cria intenção de cancelamento persistente até soltar', () => {
  assert.match(recorderSource, /cancelIntent:\s*false/)
  assert.match(recorderSource, /if \(nextGesture === 'cancel'\) activePointer\.cancelIntent = true/)
  assert.match(recorderSource, /activePointer\.cancelIntent \|\| finalGesture === 'cancel'/)
})
