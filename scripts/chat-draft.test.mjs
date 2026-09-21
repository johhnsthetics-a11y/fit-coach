import test from 'node:test'
import assert from 'node:assert/strict'
import { getChatDraftKey, loadChatDraft, saveChatDraft } from '../src/chat/chatDraft.js'

function memoryStorage() {
  const state = new Map()
  return {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => state.set(key, String(value)),
    removeItem: (key) => state.delete(key),
  }
}

test('isolates drafts by role and student conversation', () => {
  const storage = memoryStorage()
  saveChatDraft(storage, { role: 'coach', studentId: 'a' }, 'Retorno A')
  saveChatDraft(storage, { role: 'coach', studentId: 'b' }, 'Retorno B')
  saveChatDraft(storage, { role: 'student', studentId: 'a' }, 'Dúvida')

  assert.equal(loadChatDraft(storage, { role: 'coach', studentId: 'a' }), 'Retorno A')
  assert.equal(loadChatDraft(storage, { role: 'coach', studentId: 'b' }), 'Retorno B')
  assert.equal(loadChatDraft(storage, { role: 'student', studentId: 'a' }), 'Dúvida')
})

test('normalizes unsafe identifiers and removes an empty draft', () => {
  const storage = memoryStorage()
  const context = { role: 'coach', studentId: '../Aluno 01' }
  const key = getChatDraftKey(context)

  assert.doesNotMatch(key, /\.\./)
  saveChatDraft(storage, context, 'texto')
  saveChatDraft(storage, context, '')
  assert.equal(loadChatDraft(storage, context), '')
})

test('storage failures never break the conversation', () => {
  const unavailableStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
    removeItem() { throw new Error('blocked') },
  }

  assert.equal(loadChatDraft(unavailableStorage, { role: 'student', studentId: 'a' }), '')
  assert.equal(saveChatDraft(unavailableStorage, { role: 'student', studentId: 'a' }, 'mensagem'), 'mensagem')
})
