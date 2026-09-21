import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createChatMessageId } from '../src/chat/chatMessageIdentity.js'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/supabaseApi.js', import.meta.url), 'utf8')
const composer = readFileSync(new URL('../src/chat/useChatComposer.js', import.meta.url), 'utf8')
const timeline = readFileSync(new URL('../src/chat/ChatTimeline.jsx', import.meta.url), 'utf8')
const viewport = readFileSync(new URL('../src/chat/useChatViewport.js', import.meta.url), 'utf8')
const attachment = readFileSync(new URL('../src/chat/AttachmentMessage.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/chat/chat.css', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260920_idempotent_chat_messages.sql', import.meta.url), 'utf8')

test('chat message ids are valid UUIDs for database idempotency', () => {
  const firstId = createChatMessageId()
  const secondId = createChatMessageId()

  assert.match(firstId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  assert.notEqual(firstId, secondId)
})

test('chat relies on the app synchronizer instead of mounting duplicate polling loops', () => {
  assert.doesNotMatch(app, /setInterval\(refreshConversation/)
  assert.match(app, /catch \(error\)[\s\S]{0,260}throw error/)
  assert.match(app, /return \[data, setData, remoteStatus, remoteError, setRemoteStatus, setRemoteError, chatSyncError, setChatSyncError\]/)
  assert.match(app, /const \[data, setData, remoteStatus, remoteError, setRemoteStatus, setRemoteError, chatSyncError, setChatSyncError\] = useStoredData\(\)/)

  const studentPolling = app.slice(
    app.indexOf("if (!supabaseEnabled || !studentAccess?.invite?.code) return undefined"),
    app.indexOf('async function login(formData)'),
  )
  assert.equal((studentPolling.match(/setInterval\(/g) || []).length, 1)
  assert.match(studentPolling, /let pending = false/)
  assert.doesNotMatch(studentPolling, /loadRemoteStudentMessagesByInvite/)
})

test('failed sends keep a stable id and remain retryable', () => {
  assert.match(app, /clientMessageId/)
  assert.match(app, /deliveryState:\s*'failed'/)
  assert.match(timeline, /onRetryMessage/)
  assert.match(api, /messages\?on_conflict=id/)
  assert.match(api, /resolution=merge-duplicates/)
})

test('student RPC accepts the same idempotency key used by the optimistic message', () => {
  assert.match(api, /client_message_id:\s*message\.clientMessageId/)
  assert.doesNotMatch(api, /rpcRequest\('submit_student_message', legacyPayload\)/)
  assert.match(migration, /client_message_id uuid/)
  assert.match(migration, /on conflict \(id\)/i)
})

test('composer preserves a failed attempt for its original conversation', () => {
  assert.match(composer, /failedAttemptRef/)
  assert.match(composer, /attachmentDraftRef/)
  assert.match(composer, /submitContext/)
  assert.match(composer, /saveChatDraft\(resolvedStorage, submitContext/)
  assert.match(composer, /attachmentDraftRef\.current\.set\(contextKeyRef\.current, file\)/)
  assert.match(composer, /failedAttemptRef\.current\.delete\(contextKeyRef\.current\)/)
})

test('bubble retry handles a repeated network rejection', () => {
  assert.match(timeline, /Promise\.resolve\(\)\.then\(\(\) => onRetryMessage\(message\)\)\.catch/)
})

test('late image layout changes are observable without moving the reader', () => {
  assert.match(viewport, /contentRef/)
  assert.match(viewport, /observer\.observe\(contentRef\.current\)/)
  assert.match(viewport, /observer\.observe\(viewportRef\.current\)/)
  assert.match(attachment, /width="320"/)
  assert.match(attachment, /height="240"/)
})

test('trainer mobile conversation stays in app flow instead of becoming a global overlay', () => {
  const mobileCoachRule = css.match(/\.coach-auth-shell \.chat-workspace\.chat-pro-workspace\.chat-pro-mobile-conversation-open \{([\s\S]*?)\n\s*\}/)?.[1] || ''
  assert.match(mobileCoachRule, /position:\s*relative/)
  assert.doesNotMatch(mobileCoachRule, /position:\s*fixed/)
})
