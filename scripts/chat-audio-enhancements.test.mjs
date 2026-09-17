import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const productionMain = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const chatCss = readFileSync(new URL('../chat-enhancements.css', import.meta.url), 'utf8')

test('produção instala a camada de áudio do chat', () => {
  assert.match(productionMain, /installChatAudioEnhancements/)
  assert.match(productionMain, /chat-audio\.css/)
})

test('chat possui estados visuais para gravação, preview e player mobile', () => {
  assert.match(chatCss, /chat-pro-recording/)
  assert.match(chatCss, /chat-pro-audio-preview/)
  assert.match(chatCss, /chat-pro-audio-player/)
  assert.match(chatCss, /env\(safe-area-inset-bottom\)/)
  assert.match(chatCss, /100dvh/)
})
