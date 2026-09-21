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

test('áudio React limpa o microfone, suporta gesto e acompanha o teclado virtual', () => {
  assert.match(recorderSource, /stopChatAudioStream/)
  assert.match(recorderSource, /useEffect\(\(\) => \(\) =>/)
  assert.match(recorderSource, /onPointerCancel/)
  assert.match(recorderSource, /selectChatAudioMimeType/)
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
  assert.match(composerHookSource, /setDraftState\(''\)[\s\S]*?clearAttachment\(\)[\s\S]*?await onSend\(payload\)/)
})

test('botão verde envia áudio pelo submit normal sem requestAnimationFrame ou confirmação extra', () => {
  const studentSection = appSource.slice(appSource.indexOf('function StudentMessagePanel('), appSource.indexOf('function StudentConsent('))
  const coachSection = appSource.slice(appSource.indexOf('function Messages({'), appSource.indexOf('function createBlankStudent'))
  assert.doesNotMatch(studentSection, /requestAnimationFrame/)
  assert.doesNotMatch(coachSection, /requestAnimationFrame/)
  assert.match(studentSection, /<ChatConversation/)
  assert.match(coachSection, /<ChatConversation/)
  assert.match(composerSource, /type="submit"/)
})
