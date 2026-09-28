import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('chat attachments use the protected edge function and never public storage URLs', async () => {
  const api = await read('../src/supabaseApi.js')
  const edge = await read('../supabase/functions/message-attachment/index.ts')
  const migration = await read('../supabase/migrations/20260928_secure_chat_attachments_realtime.sql')

  assert.match(api, /functionFormRequest\('message-attachment'/)
  assert.match(api, /functionRequest\('message-attachment'/)
  assert.doesNotMatch(api, /publicStorageObjectUrl\(MESSAGE_ATTACHMENT_BUCKET/)
  assert.match(edge, /validateInvite/)
  assert.match(edge, /getAuthenticatedUser/)
  assert.match(edge, /createSignedUrl/)
  assert.match(edge, /message\.attachment_url/)
  assert.match(edge, /isUuid\(messageId\)/)
  assert.match(migration, /update storage\.buckets[\s\S]*public = false/i)
  assert.match(migration, /drop policy if exists "message attachments read"/i)
  assert.match(migration, /drop policy if exists "message attachments insert"/i)
})

test('chat realtime uses private authorized topics with cleanup', async () => {
  const api = await read('../src/supabaseApi.js')
  const app = await read('../src/App.jsx')
  const tokenEdge = await read('../supabase/functions/chat-realtime-token/index.ts')
  const migration = await read('../supabase/migrations/20260928_secure_chat_attachments_realtime.sql')

  assert.match(api, /config:\s*\{\s*private:\s*true\s*\}/)
  assert.match(api, /functionRequest\('chat-realtime-token'/)
  assert.match(api, /removeChannel/)
  assert.match(app, /subscribeRemoteChat/)
  assert.match(app, /return \(\) =>[\s\S]*unsubscribe/)
  assert.match(tokenEdge, /FITCOACH_REALTIME_JWT_SECRET/)
  assert.match(tokenEdge, /validateInvite/)
  assert.match(tokenEdge, /getAuthenticatedUser/)
  assert.match(migration, /on realtime\.messages/i)
  assert.match(migration, /realtime\.broadcast_changes/i)
  assert.match(migration, /chat-coach:/)
  assert.match(migration, /chat-student:/)
})

test('Cartpanda student activation requires configured product and amount', async () => {
  const webhook = await read('../supabase/functions/cartpanda-webhook/index.ts')
  const migration = await read('../supabase/migrations/20260928_secure_chat_attachments_realtime.sql')

  assert.match(webhook, /CARTPANDA_STUDENT_PRODUCT_IDS/)
  assert.match(webhook, /CARTPANDA_PATIENT_PRODUCT_IDS/)
  assert.match(webhook, /CARTPANDA_STUDENT_AMOUNT_CENTS/)
  assert.match(webhook, /CARTPANDA_PATIENT_AMOUNT_CENTS/)
  assert.match(webhook, /validateStudentPayment/)
  assert.match(webhook, /student_payment_configuration_missing/)
  assert.match(webhook, /student_payment_mismatch/)
  assert.match(webhook, /status:\s*input\.status === 'active' \? 'paid' : input\.status/)
  assert.match(migration, /student_checkout_sessions_status_check[\s\S]*'paid'/)
})
