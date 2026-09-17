import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CHAT_COMPOSER_SELECTORS,
  isNearChatBottom,
  shouldSubmitChatOnKeydown,
} from '../chatEnhancements.js'

test('chat identifica os composers reais do coach e do aluno', () => {
  assert.equal(CHAT_COMPOSER_SELECTORS.length, 2)
  assert.ok(CHAT_COMPOSER_SELECTORS.includes('textarea[placeholder="Escreva a mensagem para o aluno..."]'))
  assert.ok(CHAT_COMPOSER_SELECTORS.includes('textarea[placeholder="Responder ao coach..."]'))
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
