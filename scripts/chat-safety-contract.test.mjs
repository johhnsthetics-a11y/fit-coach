import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { transformWithEsbuild } from 'vite'

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')

test('Both professional and actual student chat use shared safety controls', () => {
  const app=read('src/App.jsx')
  const chat=read('src/chat/ChatConversation.jsx')
  assert.match(app, /inviteCode=\{inviteCode\}/)
  assert.match(chat, /useChatSafety\(\{ studentId, viewerRole, inviteCode \}\)/)
  assert.match(chat, /<ChatSafetyMenu/)
  assert.match(chat, /<ChatSafetyReportDialog/)
  assert.match(chat, /disabled=\{sendingDisabled\}/)
  assert.match(chat, /onSend=\{guardedSend\}/)
  assert.match(chat, /onRetryMessage=\{sendingDisabled \? null : guardedRetry\}/)
})
test('Message reporting is available only for incoming, non-deleted messages', () => {
  const timeline=read('src/chat/ChatTimeline.jsx')
  assert.match(timeline, /!own && !message\?\.deletedAt && message\?\.id && onReportMessage/)
  assert.match(timeline, /aria-label="Denunciar esta mensagem"/)
})
test('Chat moderation avoids reading medical records and preserves recorder/attachments', () => {
  const chat=read('src/chat/ChatConversation.jsx')
  const safety=read('src/chat/useChatSafety.js')
  const composer=read('src/chat/ChatComposer.jsx')
  assert.match(safety, /15000/)
  assert.doesNotMatch(safety, /setInterval/)
  assert.match(composer, /AudioRecorder/)
  assert.match(composer, /AudioMessage/)
  assert.match(chat, /<ChatComposer/)
})
test('Blocked state and status verification protect UI; messages are server guarded', () => {
  const hook=read('src/chat/useChatSafety.js')
  const sql=read('supabase/migrations/20261103130000_chat_safety_reports_blocks.sql')
  assert.match(hook, /viewerRole === 'student' && inviteCode/)
  assert.match(hook, /phase: 'error'/)
  assert.match(sql, /before insert on public\.messages/)
  assert.match(sql, /before update of body,attachment_url,attachment_type,attachment_name/)
  assert.match(sql, /raise exception 'Chat bloqueado/)
  assert.match(sql, /alter table public\.chat_safety_reports enable row level security/)
  assert.match(sql, /revoke all on public\.chat_safety_reports from public, anon, authenticated/)
  assert.match(sql, /chat_safety_require_master/)
  assert.match(sql, /auth\.users u/)
})
test('Master administration shows confidential report queue with review controls', () => {
  const app=read('src/App.jsx')
  const reports=read('src/chat/AdminChatReports.jsx')
  assert.match(app, /Denúncias do chat/)
  assert.match(app, /<AdminChatReports/)
  assert.match(reports, /loadRemoteChatReportsForAdmin/)
  assert.match(reports, /updateRemoteChatReportForAdmin/)
})
test('New JSX components compile with the same Vite transformation as the existing chat',async () => {
  for(const path of ['src/chat/ChatSafetyControls.jsx','src/chat/AdminChatReports.jsx','src/chat/ChatConversation.jsx','src/chat/ChatTimeline.jsx']){
    const source=read(path)
    const out=await transformWithEsbuild(source,path,{loader:'jsx',jsx:'transform'})
    assert.ok(out.code.length>0,path)
  }
})
