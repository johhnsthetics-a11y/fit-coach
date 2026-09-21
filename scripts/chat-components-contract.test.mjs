import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { transformWithEsbuild } from 'vite'

import { isNearChatBottom } from '../src/chat/useChatViewport.js'

const timeline = readFileSync(new URL('../src/chat/ChatTimeline.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/chat/chat.css', import.meta.url), 'utf8')
const composer = readFileSync(new URL('../src/chat/ChatComposer.jsx', import.meta.url), 'utf8')
const audio = readFileSync(new URL('../src/chat/AudioMessage.jsx', import.meta.url), 'utf8')
const recorder = readFileSync(new URL('../src/chat/AudioRecorder.jsx', import.meta.url), 'utf8')
const attachment = readFileSync(new URL('../src/chat/AttachmentMessage.jsx', import.meta.url), 'utf8')
const conversation = readFileSync(new URL('../src/chat/ChatConversation.jsx', import.meta.url), 'utf8')
const header = readFileSync(new URL('../src/chat/ChatHeader.jsx', import.meta.url), 'utf8')
const conversationList = readFileSync(new URL('../src/chat/ConversationList.jsx', import.meta.url), 'utf8')

test('shared timeline owns message semantics and new-message navigation', () => {
  assert.match(timeline, /export function ChatMessageList/)
  assert.match(timeline, /export function MessageBubble/)
  assert.match(timeline, /export function DateSeparator/)
  assert.match(timeline, /export function NewMessagesIndicator/)
  assert.match(timeline, /export function ChatLoadState/)
  assert.match(timeline, /aria-live="polite"/)
})

test('message CSS constrains long content and respects reduced motion', () => {
  assert.match(css, /overflow-wrap:\s*anywhere/)
  assert.match(css, /max-width:\s*min\(/)
  assert.match(css, /prefers-reduced-motion/)
})

test('scroll threshold treats a nearby reader as being at the end', () => {
  assert.equal(isNearChatBottom({ scrollHeight: 1000, scrollTop: 580, clientHeight: 320 }), true)
  assert.equal(isNearChatBottom({ scrollHeight: 1000, scrollTop: 300, clientHeight: 320 }), false)
  assert.equal(isNearChatBottom(null), true)
})

test('composer switches between microphone and submit without losing accessibility', () => {
  assert.match(composer, /aria-label="Anexar foto ou áudio"/)
  assert.match(composer, /aria-label="Enviar mensagem"/)
  assert.match(`${composer}\n${recorder}`, /aria-label="Gravar áudio"/)
  assert.match(composer, /onKeyDown/)
})

test('audio uses integrated controls instead of visible native controls', () => {
  assert.match(audio, /<audio/)
  assert.doesNotMatch(audio, /<audio[^>]*\scontrols/)
  assert.match(audio, /aria-label=.*Reproduzir áudio/)
  assert.match(audio, /type="range"/)
})

test('professional workspace exposes deterministic conversations and shared chat semantics', () => {
  assert.match(conversation, /data-chat-role=/)
  assert.match(conversation, /<ChatMessageList/)
  assert.match(conversationList, /data-conversation-id=/)
  assert.match(conversationList, /Buscar aluno ou mensagem/)
  assert.match(header, /aria-label="Voltar"/)
})

test('new chat JSX modules compile independently before integration', async () => {
  const modules = { composer, audio, recorder, attachment, timeline, conversation, header, conversationList }
  for (const [name, source] of Object.entries(modules)) {
    const result = await transformWithEsbuild(source, `${name}.jsx`, { loader: 'jsx', jsx: 'transform' })
    assert.ok(result.code.length > 0)
  }
})
