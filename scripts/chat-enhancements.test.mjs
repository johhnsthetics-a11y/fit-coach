import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  CHAT_COMPOSER_SELECTORS,
  isNearChatBottom,
  shouldSubmitChatOnKeydown,
} from '../chatEnhancements.js'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const productionMain = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

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
