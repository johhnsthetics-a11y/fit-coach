import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as chatEnhancements from '../chatEnhancements.js'

const {
  CHAT_COMPOSER_SELECTORS,
  isNearChatBottom,
  shouldSubmitChatOnKeydown,
} = chatEnhancements

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const productionMain = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const chatCss = readFileSync(new URL('../chat-enhancements.css', import.meta.url), 'utf8')

test('chat identifica os composers reais do coach e do aluno', () => {
  assert.equal(CHAT_COMPOSER_SELECTORS.length, 2)
  assert.ok(CHAT_COMPOSER_SELECTORS.includes('textarea[placeholder="Escreva a mensagem para o aluno..."]'))
  assert.ok(CHAT_COMPOSER_SELECTORS.includes('textarea[placeholder="Responder ao coach..."]'))
})

test('produção carrega o entrypoint que instala as melhorias do chat', () => {
  assert.match(indexHtml, /src\/main\.jsx/)
  assert.match(productionMain, /installChatEnhancements/)
  assert.match(productionMain, /chat-enhancements\.css/)
})

test('scroll inteligente considera o usuario perto do fim sem exigir pixel exato', () => {
  assert.equal(isNearChatBottom({ scrollHeight: 1000, scrollTop: 590, clientHeight: 320 }), true)
  assert.equal(isNearChatBottom({ scrollHeight: 1000, scrollTop: 300, clientHeight: 320 }), false)
})

test('Enter envia e Shift+Enter preserva quebra de linha', () => {
  assert.equal(shouldSubmitChatOnKeydown({ key: 'Enter', shiftKey: false, isComposing: false }), true)
  assert.equal(shouldSubmitChatOnKeydown({ key: 'Enter', shiftKey: true, isComposing: false }), false)
  assert.equal(shouldSubmitChatOnKeydown({ key: 'Enter', shiftKey: false, isComposing: true }), false)
  assert.equal(shouldSubmitChatOnKeydown({ key: 'a', shiftKey: false, isComposing: false }), false)
})

test('messenger exporta contrato semantico estavel para o layout profissional', () => {
  const classes = chatEnhancements.CHAT_MESSENGER_CLASSES
  assert.ok(classes, 'CHAT_MESSENGER_CLASSES deve existir')
  assert.deepEqual(Object.keys(classes).sort(), [
    'attachmentButton',
    'audioButton',
    'composer',
    'conversationPanel',
    'conversationPane',
    'header',
    'sendButton',
    'suggestion',
    'thread',
    'viewport',
    'workspace',
  ])
  assert.equal(classes.workspace, 'chat-pro-workspace')
  assert.equal(classes.conversationPane, 'chat-pro-conversations-pane')
  assert.equal(classes.conversationPanel, 'chat-pro-conversation-panel')
})

test('CSS do messenger cobre workspace, sugestao, composer e mobile', () => {
  assert.match(chatCss, /\.chat-pro-workspace\s*\{/)
  assert.match(chatCss, /\.chat-pro-conversations-pane\s*\{/)
  assert.match(chatCss, /\.chat-pro-conversation-panel\s*\{/)
  assert.match(chatCss, /\.chat-pro-suggestion\s*\{/)
  assert.match(chatCss, /\.chat-pro-audio-button/)
  assert.match(chatCss, /@media \(max-width: 760px\)/)
})
